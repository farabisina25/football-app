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
    $stmt = $pdo->prepare("
        SELECT 
            l.username, 
            l.slot_no, 
            l.player_name, 
            p.position, 
            p.ovr
        FROM saved_lineups l
        JOIN players p ON l.player_name = p.player_name
        WHERE l.username = ?
        ORDER BY l.slot_no ASC
    ");
    $stmt->execute([$_GET['username']]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
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
        $stmt = $pdo->prepare(
            "SELECT gp.id AS game_id, gp.username, p.*
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.username = ?"
        );
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

    if ($action === 'get_leaderboard') {
        $stmt = $pdo->query("SELECT username, slot_no, player_name FROM saved_lineups");
        $lineups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $leaderboard = [];

        foreach ($lineups as $entry) {
            $username   = $entry['username'];
            $playerName = $entry['player_name'];

            $stmt2 = $pdo->prepare("SELECT ovr FROM players WHERE player_name = ?");
            $stmt2->execute([$playerName]);
            $stats = $stmt2->fetch(PDO::FETCH_ASSOC);

            if (!$stats || !isset($stats['ovr'])) continue;

            $overall = floatval($stats['ovr']);

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
    
   if ($_GET["action"] == "process_trades") {
        $data = json_decode(file_get_contents("php://input"), true);
        $summary = [];

        // 1. Tüm korunan oyuncuları çek
        $protectedPlayers = [];
        foreach ($data as $trade) {
            if (isset($trade["protected_player"])) {
                $protectedPlayers[] = [
                    "username" => $trade["thief"], // kendi koruduğu oyuncuyu başkasına karşı korur
                    "player_name" => $trade["protected_player"]
                ];
            }
        }

        $stmtDeleteLineup = $pdo->prepare("DELETE FROM saved_lineups WHERE username = ? AND player_name = ?");
        $stmtUpdateGamePlayer = $pdo->prepare("UPDATE game_players gp JOIN players p ON gp.player_id = p.id SET gp.username = ? WHERE p.player_name = ?");

        foreach ($data as $trade) {
            $thief = $trade["thief"];
            $target = $trade["target_username"];
            $stolen = $trade["stolen_player"];
            $exchange = $trade["exchange_player"];

            // 2. Bu oyuncu herhangi biri tarafından korunmuş mu?
            $isProtected = false;
            foreach ($protectedPlayers as $prot) {
                if ($prot["player_name"] === $stolen) {
                    $isProtected = true;
                    break;
                }
            }

            if ($isProtected) {
                $summary[] = [
                    "status" => "fail",
                    "message" => "$thief kullanıcısı, $target'dan $stolen oyuncusunu çalmak istedi ama bu oyuncu koruma altında."
                ];
                continue;
            }

            // 3. Takas başarılıysa işlemleri yap
            $stmtDeleteLineup->execute([$target, $stolen]);
            $stmtUpdateGamePlayer->execute([$thief, $stolen]);

            $stmtDeleteLineup->execute([$thief, $exchange]);
            $stmtUpdateGamePlayer->execute([$target, $exchange]);

            $summary[] = [
                "status" => "success",
                "message" => "$thief, $target'dan $stolen oyuncusunu aldı ve $exchange oyuncusunu verdi."
            ];
        }

        echo json_encode([
            "success" => true,
            "message" => "Takaslar işlendi.",
            "summary" => $summary
        ]);
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
    if (isset($_GET['action']) && $_GET['action'] === 'add_game_player') {
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

}

echo json_encode(['error' => 'Unsupported request method']);
?>
