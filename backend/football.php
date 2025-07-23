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
                p.ovr,
                p.team_id
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

    /*if ($action === 'get_leaderboard') {
        $stmt = $pdo->query("SELECT l.username, l.slot_no, l.player_name, p.position, p.ovr 
                            FROM saved_lineups l
                            JOIN players p ON l.player_name = p.player_name");
        $lineups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Pozisyon-Slot oranları tablosu
        $multipliers = [
            "GK"  => [1, 0.4, 0.4, 0.3, 0.3, 0.15, 0.15, 0.10, 0.05, 0.05, 0.05],
            "RB"  => [0.3, 0.8, 0.8, 0.9, 1.0, 0.6, 0.6, 0.3, 0.15, 0.15, 0.05],
            "CB"  => [0.4, 1.0, 1.0, 0.8, 0.8, 0.3, 0.3, 0.2, 0.1, 0.1, 0.05],
            "LB"  => [0.3, 0.8, 0.8, 1.0, 0.9, 0.6, 0.6, 0.3, 0.15, 0.15, 0.05],
            "CDM" => [0.15, 0.6, 0.6, 0.8, 0.8, 1.0, 1.0, 0.6, 0.35, 0.35, 0.15],
            "CM"  => [0.15, 0.4, 0.4, 0.5, 0.5, 1.0, 1.0, 0.8, 0.6, 0.6, 0.35],
            "CAM" => [0.10, 0.15, 0.15, 0.3, 0.3, 0.8, 0.8, 1.0, 0.8, 0.8, 0.6],
            "RM"  => [0.10, 0.15, 0.15, 0.4, 0.4, 0.6, 0.6, 0.8, 0.9, 1.0, 0.6],
            "LM"  => [0.10, 0.15, 0.15, 0.4, 0.4, 0.6, 0.6, 0.8, 1.0, 0.9, 0.6],
            "RW"  => [0.05, 0.15, 0.15, 0.3, 0.3, 0.5, 0.5, 0.7, 0.9, 1.0, 0.8],
            "LW"  => [0.05, 0.15, 0.15, 0.3, 0.3, 0.5, 0.5, 0.7, 1.0, 0.9, 0.8],
            "ST"  => [0.05, 0.15, 0.15, 0.3, 0.3, 0.5, 0.5, 0.6, 0.7, 0.7, 1.0],
        ];

        $leaderboard = [];

        foreach ($lineups as $entry) {
            $username = $entry['username'];
            $position = strtoupper($entry['position']);
            $slot     = (int)$entry['slot_no'];
            $ovr      = floatval($entry['ovr']);

            // Çarpanı al
            $multiplier = $multipliers[$position][$slot - 1] ?? 0;

            $adjusted_ovr = $ovr * $multiplier;

            if (!isset($leaderboard[$username])) {
                $leaderboard[$username] = ['total' => 0, 'count' => 0];
            }

            $leaderboard[$username]['total'] += $adjusted_ovr;
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
    }*/

    if ($action === 'get_leaderboard') {
        $formationMultipliers = [
            "4231" => [
                "GK"  => [1, 0.4, 0.4, 0.3, 0.3, 0.15, 0.15, 0.15, 0.05, 0.05, 0.05],
                "RB"  => [0.3, 0.8, 0.8, 0.9, 1.0, 0.6, 0.6, 0.3, 0.15, 0.15, 0.05],
                "CB"  => [0.4, 1.0, 1.0, 0.8, 0.8, 0.3, 0.3, 0.2, 0.1, 0.1, 0.05],
                "LB"  => [0.3, 0.8, 0.8, 1.0, 0.9, 0.6, 0.6, 0.3, 0.15, 0.15, 0.05],
                "CDM" => [0.15, 0.6, 0.6, 0.8, 0.8, 1.0, 1.0, 0.6, 0.35, 0.35, 0.15],
                "CM"  => [0.15, 0.4, 0.4, 0.5, 0.5, 1.0, 1.0, 0.8, 0.6, 0.6, 0.35],
                "CAM" => [0.10, 0.15, 0.15, 0.3, 0.3, 0.8, 0.8, 1.0, 0.8, 0.8, 0.6],
                "RM"  => [0.10, 0.15, 0.15, 0.4, 0.4, 0.6, 0.6, 0.8, 0.9, 1.0, 0.6],
                "LM"  => [0.15, 0.15, 0.15, 0.4, 0.4, 0.6, 0.6, 0.8, 1.0, 0.9, 0.6],
                "RW"  => [0.05, 0.15, 0.15, 0.3, 0.3, 0.5, 0.5, 0.7, 0.9, 1.0, 0.8],
                "LW"  => [0.05, 0.15, 0.15, 0.3, 0.3, 0.5, 0.5, 0.7, 1.0, 0.9, 0.8],
                "ST"  => [0.05, 0.15, 0.15, 0.3, 0.3, 0.5, 0.5, 0.6, 0.7, 0.7, 1.0],
            ],
            "433" => [
                "GK"  => [1.0, 0.4, 0.4, 0.3, 0.3, 0.15, 0.15, 0.15, 0.05, 0.05, 0.05],
                "RB"  => [0.3, 0.4, 0.4, 0.6, 1.0, 0.7, 0.5, 0.5, 0.15, 0.2, 0.1],
                "CB"  => [0.4, 1.0, 1.0, 0.6, 0.6, 0.4, 0.3, 0.3, 0.1, 0.1, 0.05],
                "LB"  => [0.3, 0.4, 0.4, 1.0, 0.6, 0.7, 0.5, 0.5, 0.2, 0.15, 0.1],
                "CDM" => [0.15, 0.4, 0.4, 0.5, 0.5, 1.0, 0.9, 0.9, 0.4, 0.4, 0.2],
                "CM"  => [0.15, 0.3, 0.3, 0.5, 0.5, 0.9, 1.0, 1.0, 0.5, 0.5, 0.3],
                "CAM" => [0.10, 0.2, 0.2, 0.3, 0.3, 0.6, 0.8, 0.8, 0.8, 0.8, 0.6],
                "RM"  => [0.05, 0.2, 0.2, 0.3, 0.4, 0.6, 0.6, 0.8, 0.9, 1.0, 0.7],
                "LM"  => [0.05, 0.2, 0.2, 0.4, 0.3, 0.6, 0.6, 0.8, 1.0, 0.9, 0.7],
                "RW"  => [0.05, 0.1, 0.1, 0.2, 0.4, 0.5, 0.5, 0.6, 0.9, 1.0, 0.8],
                "LW"  => [0.05, 0.1, 0.1, 0.4, 0.2, 0.5, 0.5, 0.6, 1.0, 0.9, 0.8],
                "ST"  => [0.05, 0.1, 0.1, 0.3, 0.3, 0.5, 0.6, 0.6, 0.8, 0.8, 1.0],
            ],
            "442" => [
                "GK"  => [1.0, 0.4, 0.4, 0.3, 0.3, 0.15, 0.15, 0.1, 0.1, 0.05, 0.05],
                "RB"  => [0.3, 0.4, 0.4, 0.6, 1.0, 0.7, 0.7, 0.3, 0.9, 0.1, 0.1],
                "CB"  => [0.4, 1.0, 1.0, 0.6, 0.6, 0.4, 0.4, 0.2, 0.2, 0.05, 0.05],
                "LB"  => [0.3, 0.4, 0.4, 1.0, 0.6, 0.7, 0.7, 0.9, 0.3, 0.1, 0.1],
                "CDM" => [0.15, 0.4, 0.4, 0.5, 0.5, 1.0, 1.0, 0.6, 0.6, 0.2, 0.2],
                "CM"  => [0.15, 0.3, 0.3, 0.5, 0.5, 1.0, 1.0, 0.8, 0.8, 0.3, 0.3],
                "CAM" => [0.10, 0.2, 0.2, 0.3, 0.3, 0.6, 0.6, 0.9, 0.9, 0.8, 0.8],
                "RM"  => [0.05, 0.2, 0.2, 0.3, 0.4, 0.6, 0.6, 0.7, 1.0, 0.7, 0.7],
                "LM"  => [0.05, 0.2, 0.2, 0.4, 0.3, 0.6, 0.6, 1.0, 0.7, 0.7, 0.7],
                "RW"  => [0.05, 0.1, 0.1, 0.2, 0.3, 0.4, 0.4, 0.6, 1.0, 0.9, 0.9],
                "LW"  => [0.05, 0.1, 0.1, 0.3, 0.2, 0.4, 0.4, 1.0, 0.6, 0.9, 0.9],
                "ST"  => [0.05, 0.1, 0.1, 0.3, 0.3, 0.5, 0.5, 0.6, 0.6, 1.0, 1.0],
            ],
            "352" => [
                "GK"  => [1.0, 0.5, 0.5, 0.5, 0.3, 0.3, 0.15, 0.15, 0.1, 0.05, 0.05],
                "CB"  => [0.4, 1.0, 1.0, 1.0, 0.6, 0.6, 0.3, 0.3, 0.1, 0.05, 0.05],
                "RB"  => [0.3, 0.4, 0.4, 0.8, 0.7, 0.7, 0.2, 1.0, 0.5, 0.1, 0.1],
                "LB"  => [0.3, 0.4, 0.8, 0.4, 0.7, 0.7, 1.0, 0.2, 0.5, 0.1, 0.1],
                "CDM" => [0.2, 0.5, 0.5, 0.5, 1.0, 1.0, 0.5, 0.5, 0.4, 0.2, 0.2],
                "CM"  => [0.15, 0.4, 0.4, 0.4, 1.0, 1.0, 0.6, 0.6, 0.6, 0.3, 0.3],
                "CAM" => [0.10, 0.2, 0.2, 0.2, 0.5, 0.5, 0.7, 0.7, 1.0, 0.8, 0.8],
                "LM"  => [0.05, 0.1, 0.2, 0.1, 0.4, 0.4, 1.0, 0.8, 0.6, 0.5, 0.5],
                "RM"  => [0.05, 0.1, 0.1, 0.2, 0.4, 0.4, 0.8, 1.0, 0.6, 0.5, 0.5],
                "RW"  => [0.05, 0.05, 0.1, 0.1, 0.3, 0.3, 0.6, 1.0, 0.7, 0.9, 0.9],
                "LW"  => [0.05, 0.05, 0.1, 0.1, 0.3, 0.3, 1.0, 0.6, 0.7, 0.9, 0.9],
                "ST"  => [0.05, 0.05, 0.1, 0.1, 0.2, 0.2, 0.4, 0.4, 0.8, 1.0, 1.0],
            ],
            "343" => [
                "GK"  => [1.0, 0.5, 0.4, 0.4, 0.3, 0.3, 0.15, 0.15, 0.05, 0.05, 0.05],
                "CB"  => [0.4, 1.0, 1.0, 1.0, 0.5, 0.5, 0.3, 0.3, 0.1, 0.1, 0.05],
                "RB"  => [0.3, 0.4, 0.4, 0.8, 0.7, 0.7, 0.3, 1.0, 0.4, 0.3, 0.1],
                "LB"  => [0.3, 0.4, 0.8, 0.4, 0.7, 0.7, 1.0, 0.3, 0.4, 0.3, 0.1],
                "CDM" => [0.2, 0.5, 0.5, 0.5, 1.0, 1.0, 0.5, 0.5, 0.2, 0.2, 0.1],
                "CM"  => [0.15, 0.4, 0.4, 0.4, 1.0, 1.0, 0.7, 0.7, 0.4, 0.4, 0.2],
                "CAM" => [0.10, 0.2, 0.2, 0.2, 0.5, 0.5, 0.8, 0.8, 0.9, 0.9, 1.0],
                "LM"  => [0.05, 0.1, 0.2, 0.1, 0.4, 0.4, 1.0, 0.7, 0.8, 0.5, 0.3],
                "RM"  => [0.05, 0.1, 0.1, 0.2, 0.4, 0.4, 0.7, 1.0, 0.5, 0.8, 0.3],
                "RW"  => [0.05, 0.05, 0.1, 0.1, 0.2, 0.2, 0.5, 0.8, 0.6, 1.0, 0.9],
                "LW"  => [0.05, 0.05, 0.1, 0.1, 0.2, 0.2, 0.8, 0.5, 1.0, 0.6, 0.9],
                "ST"  => [0.05, 0.05, 0.1, 0.1, 0.2, 0.2, 0.4, 0.4, 0.7, 0.7, 1.0],
            ],
            "532" => [
                "GK"  => [1.0, 0.5, 0.5, 0.5, 0.3, 0.3, 0.2, 0.2, 0.1, 0.05, 0.05],
                "CB"  => [0.4, 1.0, 1.0, 1.0, 0.6, 0.6, 0.3, 0.3, 0.1, 0.05, 0.05],
                "RB"  => [0.3, 0.5, 0.4, 0.8, 0.6, 1.0, 0.3, 0.5, 0.2, 0.1, 0.1],
                "LB"  => [0.3, 0.5, 0.8, 0.4, 1.0, 0.6, 0.5, 0.3, 0.2, 0.1, 0.1],
                "CDM" => [0.2, 0.4, 0.4, 0.4, 0.6, 0.6, 1.0, 1.0, 0.5, 0.2, 0.2],
                "CM"  => [0.15, 0.3, 0.3, 0.3, 0.6, 0.6, 1.0, 1.0, 0.6, 0.3, 0.3],
                "CAM" => [0.10, 0.2, 0.2, 0.2, 0.5, 0.5, 0.8, 0.8, 1.0, 0.8, 0.8],
                "LM"  => [0.05, 0.1, 0.2, 0.2, 1.0, 0.6, 0.6, 0.3, 0.4, 0.4, 0.3],
                "RM"  => [0.05, 0.1, 0.2, 0.2, 0.6, 1.0, 0.3, 0.6, 0.4, 0.4, 0.3],
                "RW"  => [0.05, 0.1, 0.1, 0.1, 0.3, 0.5, 0.3, 0.5, 0.7, 0.9, 0.9],
                "LW"  => [0.05, 0.1, 0.1, 0.1, 0.5, 0.3, 0.5, 0.3, 0.7, 0.9, 0.9],
                "ST"  => [0.05, 0.1, 0.1, 0.1, 0.3, 0.3, 0.4, 0.4, 0.8, 1.0, 1.0],
            ]
        ];
           // Formasyonlar frontend'den sırayla gelir
        $formations = [
            $_GET['formation1'] ?? null,
            $_GET['formation2'] ?? null,
            $_GET['formation3'] ?? null,
            $_GET['formation4'] ?? null
        ];

        // Kadro verisini çek
        $stmt = $pdo->query("SELECT l.username, l.slot_no, l.player_name, p.position, p.ovr 
                            FROM saved_lineups l
                            JOIN players p ON l.player_name = p.player_name");
        $lineups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Kullanıcı isimlerini sıra koruyarak topla
        $usernames = array_values(array_unique(array_column($lineups, 'username')));

        // Kullanıcı başına formasyon eşle
        $userFormations = [];
        foreach ($usernames as $index => $user) {
            $userFormations[$user] = $formations[$index] ?? '4231'; // fallback
        }

        $leaderboard = [];

        foreach ($lineups as $entry) {
            $username = $entry['username'];
            $position = strtoupper($entry['position']);
            $slot     = (int)$entry['slot_no'];
            $player   = $entry['player_name'];
            $ovr      = floatval($entry['ovr']);
            $formation = $userFormations[$username] ?? '4231';

            $multipliers = $formationMultipliers[$formation] ?? [];

            $multiplier = isset($multipliers[$position][$slot - 1]) ? $multipliers[$position][$slot - 1] : 0;
            $adjusted_ovr = $ovr * $multiplier;

            if (!isset($leaderboard[$username])) {
                $leaderboard[$username] = [
                    'total' => 0,
                    'count' => 0,
                    'formation' => $formation,
                    'details' => []
                ];
            }

            $leaderboard[$username]['total'] += $adjusted_ovr;
            $leaderboard[$username]['count'] += 1;
            $leaderboard[$username]['details'][] = [
                'player' => $player,
                'position' => $position,
                'slot' => $slot,
                'original_ovr' => $ovr,
                'multiplier' => $multiplier,
                'adjusted_ovr' => $adjusted_ovr
            ];
        }

        $result = [];
        foreach ($leaderboard as $user => $data) {
            $avg = $data['count'] > 0 ? $data['total'] / $data['count'] : 0;
            $result[] = [
                'username' => $user,
                'formation' => $data['formation'],
                'power' => number_format($avg, 2, '.', ''),
                'players' => $data['details']
            ];
        }

        usort($result, fn($a, $b) => $b['power'] <=> $a['power']);

        echo json_encode($result);
        exit;
    }
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
            if (
                !isset($trade["thief"], $trade["target_username"], $trade["stolen_player"], $trade["exchange_player"]) ||
                empty($trade["thief"]) || empty($trade["target_username"]) || empty($trade["stolen_player"]) || empty($trade["exchange_player"])
            ) {
                $summary[] = [
                    "status" => "fail",
                    "message" => "Eksik bilgi nedeniyle bir takas işlenemedi."
                ];
                continue; // Bu trade'i atla
            }
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
