<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

// 🔌 Veritabanı bağlantısı
$host = 'localhost';
$db   = 'football_db';
$user = 'root';
$pass = 'fa2003si';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     http_response_code(500);
     echo json_encode(['error' => $e->getMessage()]);
     exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? null;

    if ($action === 'get_teams') {
        $stmt = $pdo->query("SELECT * FROM teams");
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($action === 'get_players_by_team' && isset($_GET['team_id'])) {
        $stmt = $pdo->prepare("SELECT * FROM players WHERE team_id = ?");
        $stmt->execute([$_GET['team_id']]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($action === 'get_lineup' && isset($_GET['username'])) {
        $stmt = $pdo->prepare("SELECT username, slot_no, player_name FROM saved_lineups WHERE username = ? ORDER BY slot_no ASC");
        $stmt->execute([$_GET['username']]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($action === 'get_all_lineups') {
        $stmt = $pdo->query("SELECT username, player_name FROM saved_lineups");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }

    if ($action === 'get_all_game_players') {
        $stmt = $pdo->query("
            SELECT gp.username, p.player_name
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
        ");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }


    if ($action === 'user_players' && isset($_GET['username'])) {
        $stmt = $pdo->prepare("
            SELECT gp.id AS game_id, gp.username, p.*
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.username = ?
            ORDER BY p.player_no ASC
        ");
        $stmt->execute([$_GET['username']]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($action === 'reset_game') {
        try {
            $pdo->exec("TRUNCATE TABLE saved_lineups");
            $pdo->exec("TRUNCATE TABLE game_players");
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        exit;
    }

    elseif ($action === 'process_trades') {
        $input = json_decode(file_get_contents("php://input"), true);

        if (!$input || !is_array($input)) {
            echo json_encode([
                "success" => false,
                "error" => "Veri alınamadı veya yanlış format: " . json_encode($input)
            ]);
            exit;
        }
        if (!is_array($input)) {
            echo json_encode(["success" => false, "error" => "Geçersiz veri yapısı."]);
            exit;
        }

        $stmtGetLineup = $pdo->prepare("SELECT * FROM lineup WHERE username = :username");
        $stmtUpdateLineup = $pdo->prepare("UPDATE lineup SET player_name = :player_name WHERE username = :username AND slot_no = :slot_no");

        $stmtUpdateGamePlayers = $pdo->prepare("UPDATE game_players SET username = :username WHERE player_name = :player_name");

        foreach ($input as $trade) {
            $thief = $trade["thief"];
            $target = $trade["target_username"];
            $stolenPlayer = $trade["stolen_player"];
            $protectedPlayer = $trade["protected_player"];

            // Eğer çalınmak istenen oyuncu korunduysa bu takas iptal edilir
            if ($stolenPlayer === $protectedPlayer) {
                continue;
            }

            // Her iki oyuncunun kadrolarını al
            $stmtGetLineup->execute(["username" => $thief]);
            $thiefLineup = $stmtGetLineup->fetchAll(PDO::FETCH_ASSOC);

            $stmtGetLineup->execute(["username" => $target]);
            $targetLineup = $stmtGetLineup->fetchAll(PDO::FETCH_ASSOC);

            // Çalınmak istenen oyuncunun slot numarasını bul
            $targetSlot = null;
            foreach ($targetLineup as $entry) {
                if (trim($entry["player_name"]) === trim($stolenPlayer)) {
                    $targetSlot = $entry["slot_no"];
                    break;
                }
            }

            if (!$targetSlot) {
                continue; // slot bulunamadıysa işlem iptal
            }

            // Hırsızın bu slotta hangi oyuncusu var
            $thiefPlayer = null;
            foreach ($thiefLineup as $entry) {
                if ((int)$entry["slot_no"] === (int)$targetSlot) {
                    $thiefPlayer = $entry["player_name"];
                    break;
                }
            }

            if (!$thiefPlayer) {
                continue;
            }

            // LİNEUP tablolarını güncelle
            $stmtUpdateLineup->execute([
                "username" => $thief,
                "slot_no" => $targetSlot,
                "player_name" => $stolenPlayer
            ]);

            $stmtUpdateLineup->execute([
                "username" => $target,
                "slot_no" => $targetSlot,
                "player_name" => $thiefPlayer
            ]);

            // GAME_PLAYERS tablolarını güncelle
            $stmtUpdateGamePlayers->execute([
                "username" => $thief,
                "player_name" => $stolenPlayer
            ]);

            $stmtUpdateGamePlayers->execute([
                "username" => $target,
                "player_name" => $thiefPlayer
            ]);
        }

        echo json_encode(["success" => true]);
        exit;
    }


    if ($action === 'get_leaderboard') {
        $stmt = $pdo->query("SELECT username, slot_no, player_name FROM saved_lineups");
        $lineups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $leaderboard = [];

        // Doğru slot formülleri (defence!)
        $weights = [
            1  => ['keeper' => 1],
            2  => ['defence' => 0.8, 'mid' => 0.2],
            3  => ['defence' => 0.8, 'mid' => 0.2],
            4  => ['defence' => 0.6, 'mid' => 0.4],
            5  => ['defence' => 0.6, 'mid' => 0.4],
            6  => ['defence' => 0.3, 'mid' => 0.7],
            7  => ['defence' => 0.3, 'mid' => 0.7],
            8  => ['mid' => 0.7, 'forward' => 0.3],
            9  => ['mid' => 0.2, 'forward' => 0.8],
            10 => ['mid' => 0.2, 'forward' => 0.8],
            11 => ['forward' => 1]
        ];

        foreach ($lineups as $entry) {
            $username   = $entry['username'];
            $playerName = $entry['player_name'];
            $slot       = (int)$entry['slot_no'];

            $stmt2 = $pdo->prepare("SELECT forward, mid, defence, keeper FROM players WHERE player_name = ?");
            $stmt2->execute([$playerName]);
            $stats = $stmt2->fetch(PDO::FETCH_ASSOC);

            if (!$stats || !isset($weights[$slot])) continue;

            $overall = 0;
            foreach ($weights[$slot] as $key => $weight) {
                $overall += floatval($stats[$key]) * $weight;
            }

            if (!isset($leaderboard[$username])) {
                $leaderboard[$username] = ['total' => 0, 'count' => 0];
            }

            $leaderboard[$username]['total'] += $overall;
            $leaderboard[$username]['count'] += 1;
        }

        $result = [];
        foreach ($leaderboard as $user => $data) {
            $avg = $data['count'] > 0 ? $data['total'] / $data['count'] : 0;
            $result[] = [
                'username' => $user,
                'power' => number_format($avg, 2, '.', '')
            ];
        }

        usort($result, fn($a, $b) => $b['power'] <=> $a['power']);

        echo json_encode($result);
        exit;
    }

    echo json_encode(['error' => 'Invalid GET parameters']);
    exit;
}



// 🧠 POST işlemi
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);

    // Eğer array değilse hata döndür
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Geçersiz veri formatı']);
        exit;
    }

    // save_lineup action'ı: kadroyu kaydetme
    if (isset($_GET['action']) && $_GET['action'] === 'save_lineup') {
        try {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM saved_lineups WHERE username = ?")->execute([$input[0]['username']]);
            foreach ($input as $item) {
                if (!isset($item['username'], $item['slot_no'], $item['player_name'])) {
                    $pdo->rollBack();
                    http_response_code(400);
                    echo json_encode(['error' => 'Eksik parametre']);
                    exit;
                }

                $stmt = $pdo->prepare("INSERT INTO saved_lineups (username, slot_no, player_name) VALUES (?, ?, ?)");
                $stmt->execute([
                    $item['username'],
                    $item['slot_no'],
                    $item['player_name']
                ]);
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;
    }

    // Varsayılan: game_players'a oyuncu ekleme
    if (!isset($input['username'], $input['team_id'], $input['player_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Eksik parametre', 'received' => $input]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO game_players (username, team_id, player_id) VALUES (?, ?, ?)");
        $stmt->execute([
            $input['username'],
            $input['team_id'],
            $input['player_id']
        ]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}



echo json_encode(['error' => 'Unsupported request method']);
?>
