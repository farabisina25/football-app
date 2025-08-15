<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit(); }

// Hataları logla, EKRANA BASMA (JSON’u bozmasın)
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);


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


    if ($action === 'user_players') {
        try {
            $username = trim($_GET['username'] ?? '');
            if ($username === '') {
                echo json_encode([]);
                exit;
            }

            $stmt = $pdo->prepare("
                SELECT 
                gp.id AS game_id, 
                gp.username, 
                p.id AS player_id, 
                p.player_name, 
                p.position, 
                p.team_id
                FROM game_players gp
                JOIN players p ON gp.player_id = p.id
                WHERE TRIM(gp.username) = TRIM(?)
            ");
            $stmt->execute([$username]);
            $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($players);
            exit;
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(["success"=>false, "error"=>"user_players failed", "details"=>$e->getMessage()]);
            exit;
        }
    }

    if ($action === 'get_lineup' && isset($_GET['username'])) {
    header('Content-Type: application/json; charset=utf-8');
    // Ekrana hata basma — JSON’u bozmasın
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    error_reporting(E_ALL);

    try {
        $username = trim($_GET['username'] ?? '');

        // 1) Önce JOIN’siz çalışıyor mu? (tablo/kolon var mı)
        $stmt = $pdo->prepare("
            SELECT 
                l.username,
                l.slot_no,
                l.player_name
            FROM saved_lineups l
            WHERE l.username = ?
            ORDER BY l.slot_no ASC
        ");
        $stmt->execute([$username]);
        $base = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 2) JOIN ile zenginleştirmeyi ayrı TRY içinde dene.
        //    Hata olursa 500 atma; sadece 'needs_enrichment' ile düz isimleri gönder.
        try {
            if (!empty($base)) {
                // player_name’lere göre players’tan position & team_id çek
                $names = array_values(array_unique(array_map(fn($r) => $r['player_name'], $base)));
                // isim listesi kadar placeholder
                $in  = implode(',', array_fill(0, count($names), '?'));

                $sql = "
                    SELECT p.player_name, p.`position` AS position, p.team_id
                    FROM players p
                    WHERE p.player_name IN ($in)
                ";
                $ps = $pdo->prepare($sql);
                $ps->execute($names);
                $extraRows = $ps->fetchAll(PDO::FETCH_ASSOC);

                // player_name -> meta map
                $meta = [];
                foreach ($extraRows as $er) {
                    $meta[$er['player_name']] = [
                        'position' => $er['position'] ?? '',
                        'team_id'  => $er['team_id'] ?? ''
                    ];
                }

                // base’e işle
                foreach ($base as &$r) {
                    $m = $meta[$r['player_name']] ?? ['position'=>'', 'team_id'=>''];
                    $r['position'] = $m['position'];
                    $r['team_id']  = $m['team_id'];
                }
                unset($r);
            }

            echo json_encode($base, JSON_UNESCAPED_UNICODE);
            exit;

        } catch (Throwable $joinErr) {
            // JOIN tarafı patlarsa yine de isimleri döndür
            http_response_code(200);
            echo json_encode([
                'needs_enrichment' => true,
                'rows' => $base,
                'join_error' => $joinErr->getMessage()
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

    } catch (Throwable $e) {
        http_response_code(200); // 500 yerine 200 + hata bilgisi (frontend’i bloklama)
        echo json_encode([
            'success' => false,
            'error'   => 'get_lineup base query failed',
            'details' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
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
    header('Content-Type: application/json; charset=utf-8');
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    error_reporting(E_ALL);

    // Tüm formasyon çarpanları
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

    // Pozisyon normalizasyonu (RWB->RB, LWB->LB, CF->ST, vs.)
    $posMap = [
        'RWB'=>'RB', 'LWB'=>'LB', 'CF'=>'ST',
        'DM'=>'CDM', 'AMC'=>'CAM', 'MC'=>'CM', 'ML'=>'LM', 'MR'=>'RM',
        'RCB'=>'CB','LCB'=>'CB','CBR'=>'CB','CBL'=>'CB'
    ];
    $normalizePos = function($p) use ($posMap) {
        $p = strtoupper(trim((string)$p));
        return $posMap[$p] ?? $p;
    };

    try {
        // 1) saved_lineups (JOIN yok)
        $stmt = $pdo->query("
            SELECT l.username, l.slot_no, l.player_name
            FROM saved_lineups l
            ORDER BY l.username, l.slot_no
        ");
        $lineups = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!$lineups) { echo json_encode([]); exit; }

        // 2) Frontend'den gelen formasyonlar
        $userFormations = [];
        foreach ($_GET as $key => $value) {
            if (strpos($key, 'formation_') === 0) {
                $username = urldecode(substr($key, strlen('formation_')));
                $userFormations[trim($username)] = $value ?: '4231';
            }
        }

        // 3) players meta toplu çekim (collation güvenli)
        $names = array_values(array_unique(array_map(function($r){ return $r['player_name']; }, $lineups)));
        $in = implode(',', array_fill(0, count($names), '?'));

        $sql = "
            SELECT 
                p.player_name,
                UPPER(TRIM(p.`position`)) AS position,
                CASE WHEN p.ovr IS NULL OR p.ovr = '' THEN 0 ELSE p.ovr END AS ovr
            FROM players p
            WHERE CONVERT(p.player_name USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ($in)
        ";
        $ps = $pdo->prepare($sql);
        $ps->execute($names);
        $rows = $ps->fetchAll(PDO::FETCH_ASSOC);

        $meta = [];
        foreach ($rows as $r) {
            $meta[$r['player_name']] = [
                'position' => $normalizePos($r['position'] ?? ''),
                'ovr'      => is_numeric($r['ovr'] ?? null) ? (float)$r['ovr'] : 0.0
            ];
        }

        // 4) Puan hesaplama
        $leaderboard = [];
        foreach ($lineups as $entry) {
            $username = $entry['username'];
            $slot     = (int)$entry['slot_no'];
            $pname    = $entry['player_name'];

            $m = $meta[$pname] ?? ['position'=>'', 'ovr'=>0.0];
            $position = $normalizePos($m['position']);
            $ovr      = (float)($m['ovr'] ?? 0);

            $formation   = $userFormations[$username] ?? '4231';
            $multipliers = $formationMultipliers[$formation] ?? [];
            $multiplier  = isset($multipliers[$position][$slot - 1]) ? (float)$multipliers[$position][$slot - 1] : 0.0;

            $adjusted_ovr = $ovr * $multiplier;

            if (!isset($leaderboard[$username])) {
                $leaderboard[$username] = [
                    'total' => 0, 'count' => 0,
                    'formation' => $formation,
                    'details' => []
                ];
            }
            $leaderboard[$username]['total']  += $adjusted_ovr;
            $leaderboard[$username]['count']  += 1;
            $leaderboard[$username]['details'][] = [
                'player' => $pname,
                'position' => $position,
                'slot' => $slot,
                'original_ovr' => $ovr,
                'multiplier' => $multiplier,
                'adjusted_ovr' => $adjusted_ovr
            ];
        }

        // 5) Çıkış
        $result = [];
        foreach ($leaderboard as $user => $data) {
            $avg = $data['count'] > 0 ? $data['total'] / $data['count'] : 0;
            $result[] = [
                'username'  => $user,
                'formation' => $data['formation'],
                'power'     => number_format($avg, 2, '.', ''),
                'players'   => $data['details']
            ];
        }
        usort($result, fn($a, $b) => $b['power'] <=> $a['power']);

        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;

    } catch (Throwable $e) {
        http_response_code(200);
        echo json_encode([
            'success' => false,
            'error'   => 'get_leaderboard failed',
            'details' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

    // --- GET: full_teams listesi (opsiyonel lig filtresi) ---
    if ($action === 'get_full_teams') {
        if (!empty($_GET['league'])) {
            $stmt = $pdo->prepare("SELECT team_id, team_name, league FROM full_teams WHERE league = ? ORDER BY team_name");
            $stmt->execute([$_GET['league']]);
            echo json_encode($stmt->fetchAll());
            exit;
        } else {
            $stmt = $pdo->query("SELECT team_id, team_name, league FROM full_teams ORDER BY team_name");
            echo json_encode($stmt->fetchAll());
            exit;
        }
    }

    // --- GET: full_teams içinden distinct lig listesi ---
    if ($action === 'get_full_teams_leagues') {
        $stmt = $pdo->query("SELECT DISTINCT league FROM full_teams ORDER BY league");
        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($action === 'get_full_teams_by_ids') {
        $idsParam = trim($_GET['ids'] ?? '');
        if ($idsParam === '') {
            echo json_encode([]); exit;
        }

        // ids= "1,3,4,5" gibi gelir → filtrele, int'e çevir, tekrarları kaldır
        $ids = array_filter(array_unique(array_map(function($v){
            return (int)trim($v);
        }, explode(',', $idsParam))), function($x){ return $x > 0; });

        if (empty($ids)) { echo json_encode([]); exit; }

        // Placeholder'ları hazırla
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        $sql = "SELECT team_id, team_name, league 
                FROM full_teams 
                WHERE team_id IN ($placeholders)
                ORDER BY team_name";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($ids);

        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
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

    // POST: teams_add -> full_teams’ten seçilen team_id’yi teams tablosuna (id, team_name) olarak yaz
    if (isset($_GET['action']) && $_GET['action'] === 'teams_add') {
        if (!isset($input['team_id'])) { http_response_code(400); echo json_encode(['error'=>'team_id gerekli']); exit; }
        $teamId = (int)$input['team_id'];

        try {
            $stmt = $pdo->prepare("SELECT team_id, team_name FROM full_teams WHERE team_id = ?");
            $stmt->execute([$teamId]);
            $row = $stmt->fetch();
            if (!$row) { http_response_code(404); echo json_encode(['error'=>'full_teams içinde bulunamadı']); exit; }

            // id’yi de aynı değerle yaz. Varsa güncelleme yap, hata verme.
            $stmt2 = $pdo->prepare("
                INSERT INTO teams (id, team_name)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE team_name = VALUES(team_name)
            ");
            $stmt2->execute([$row['team_id'], $row['team_name']]);

            echo json_encode(['success'=>true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error'=>$e->getMessage()]);
        }
        exit;
    }

    // POST: teams_add_bulk -> Birden fazla team_id'yi tek seferde teams tablosuna ekle
    if (isset($_GET['action']) && $_GET['action'] === 'teams_add_bulk') {
        // Beklenen payload: { "team_ids": [1,3,4,5,...] }
        $teamIds = $input['team_ids'] ?? null;
        if (!is_array($teamIds) || empty($teamIds)) {
            http_response_code(400);
            echo json_encode(['error' => 'team_ids (array) gerekli']); 
            exit;
        }

        // Temizle, int'e çevir, tekrarları at
        $ids = array_filter(array_unique(array_map('intval', $teamIds)), function($x){ return $x > 0; });
        if (empty($ids)) { echo json_encode(['success'=>true, 'inserted'=>0]); exit; }

        try {
            $pdo->beginTransaction();

            // full_teams'tan verileri çek
            $in = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $pdo->prepare("
                SELECT team_id, team_name
                FROM full_teams
                WHERE team_id IN ($in)
            ");
            $stmt->execute($ids);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($rows)) {
                $pdo->commit();
                echo json_encode(['success'=>true, 'inserted'=>0]); 
                exit;
            }

            // teams tablosuna upsert
            $ins = $pdo->prepare("
                INSERT INTO teams (id, team_name)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE team_name = VALUES(team_name)
            ");

            $count = 0;
            foreach ($rows as $r) {
                $ins->execute([(int)$r['team_id'], $r['team_name']]);
                $count++;
            }

            $pdo->commit();
            echo json_encode(['success'=>true, 'inserted'=>$count]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error'=>$e->getMessage()]);
        }
        exit;
    }


}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $action = $_GET['action'] ?? null;

    if ($action === 'teams_remove') {
        if (!isset($_GET['id'])) { http_response_code(400); echo json_encode(['error'=>'id gerekli']); exit; }
        try {
            $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            echo json_encode(['success'=>true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error'=>$e->getMessage()]);
        }
        exit;
    }

    // team_id ile silme diye bir alan artık yok; istersen isimle silme ekleyebilirsin:
    if ($action === 'teams_remove_by_name') {
        if (!isset($_GET['team_name'])) { http_response_code(400); echo json_encode(['error'=>'team_name gerekli']); exit; }
        try {
            $stmt = $pdo->prepare("DELETE FROM teams WHERE team_name = ?");
            $stmt->execute([$_GET['team_name']]);
            echo json_encode(['success'=>true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error'=>$e->getMessage()]);
        }
        exit;
    }

    // Tümünü sil – TRUNCATE FK yüzünden patlayabilir, DELETE tercih et:
    if ($action === 'teams_truncate') {
        try {
            $pdo->exec("DELETE FROM teams"); // TRUNCATE yerine
            echo json_encode(['success'=>true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error'=>$e->getMessage()]);
        }
        exit;
    }
}

echo json_encode(['error' => 'Unsupported request method']);
?>
