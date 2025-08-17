<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, X-User-Id");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit(); }

// Hataları logla, EKRANA BASMA (JSON’u bozmasın)
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// ZORUNLU: X-User-Id header
$userId = $_SERVER['HTTP_X_USER_ID'] ?? '';
$userId = trim($userId);
if ($userId === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing X-User-Id header']);
    exit;
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

    // Kullanıcının seçtiği takımlar (user_teams + full_teams)
    if ($action === 'get_teams') {
        $stmt = $pdo->prepare("
            SELECT ft.team_id AS id, ft.team_name, ft.league
            FROM user_teams ut
            JOIN full_teams ft ON ft.team_id = ut.team_id
            WHERE ut.user_id = ?
            ORDER BY ft.team_name
        ");
        $stmt->execute([$userId]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // Global players tablosu: belirli takımın oyuncuları
    if ($action === 'get_players_by_team' && isset($_GET['team_id'])) {
        $stmt = $pdo->prepare("SELECT * FROM players WHERE team_id = ?");
        $stmt->execute([$_GET['team_id']]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // Bu kullanıcının tüm lineup kayıtları (sade liste)
    if ($action === 'get_all_lineups') {
        $stmt = $pdo->prepare("
            SELECT username, player_name 
            FROM saved_lineups
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }

    // Bu kullanıcının game_players kayıtları (isimle)
    if ($action === 'get_all_game_players') {
        $stmt = $pdo->prepare("
            SELECT gp.username, p.player_name
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.user_id = ?
        ");
        $stmt->execute([$userId]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }

    // Belirli username için bu kullanıcının game_players
    if ($action === 'user_players') {
        try {
            $username = trim($_GET['username'] ?? '');
            if ($username === '') { echo json_encode([]); exit; }

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
                WHERE gp.user_id = ?
                  AND TRIM(gp.username) = TRIM(?)
            ");
            $stmt->execute([$userId, $username]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            exit;
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(["success"=>false, "error"=>"user_players failed", "details"=>$e->getMessage()]);
            exit;
        }
    }

    if ($action === 'get_lineup' && isset($_GET['username'])) {
        header('Content-Type: application/json; charset=utf-8');
        ini_set('display_errors', 0);
        ini_set('log_errors', 1);
        error_reporting(E_ALL);

        try {
            $username = trim($_GET['username'] ?? '');

            // Base: bu kullanıcının kayıtları
            $stmt = $pdo->prepare("
                SELECT l.username, l.slot_no, l.player_name, l.player_id, l.position AS saved_position, l.team_id AS saved_team_id
                FROM saved_lineups l
                WHERE l.user_id = ?
                AND l.username = ?
                ORDER BY l.slot_no ASC
            ");
            $stmt->execute([$userId, $username]);
            $base = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($base)) {
                // Önce ID'lerle zenginleştir
                $ids = array_values(array_unique(array_filter(array_map(fn($r)=>$r['player_id'] ?? null, $base))));
                $metaById = [];
                if (!empty($ids)) {
                    $in = implode(',', array_fill(0, count($ids), '?'));
                    $ps = $pdo->prepare("SELECT id, player_name, `position`, team_id FROM players WHERE id IN ($in)");
                    $ps->execute($ids);
                    foreach ($ps->fetchAll(PDO::FETCH_ASSOC) as $row) {
                        $metaById[(int)$row['id']] = $row;
                    }
                }

                // ID'si olmayanlar için (eski kayıtlar) isimle fallback (riskli ama geçici)
                $names = array_values(array_unique(array_map(fn($r)=>$r['player_name'], array_filter($base, fn($r)=>empty($r['player_id'])))));
                $metaByName = [];
                if (!empty($names)) {
                    $in = implode(',', array_fill(0, count($names), '?'));
                    $ps2 = $pdo->prepare("SELECT player_name, `position`, team_id, id FROM players WHERE player_name IN ($in)");
                    $ps2->execute($names);
                    foreach ($ps2->fetchAll(PDO::FETCH_ASSOC) as $row) {
                        $metaByName[$row['player_name']] = $row; // birden fazla olabilir; ilkini alıyoruz (geçici)
                    }
                }

                foreach ($base as &$r) {
                    $pid = $r['player_id'] ? (int)$r['player_id'] : null;
                    $m = $pid && isset($metaById[$pid]) ? $metaById[$pid]
                        : ($metaByName[$r['player_name']] ?? ['position'=>'', 'team_id'=>null, 'id'=>null]);

                    // COALESCE: kaydedilmiş varsa onu kullan
                    $r['player_id'] = $pid ?: ($m['id'] ?? null);
                    $r['position']  = $r['saved_position'] ?: ($m['position'] ?? '');
                    $r['team_id']   = $r['saved_team_id']  ?: ($m['team_id'] ?? null);
                    unset($r['saved_position'], $r['saved_team_id']);
                }
                unset($r);
            }

            echo json_encode($base, JSON_UNESCAPED_UNICODE);
            exit;

        } catch (Throwable $e) {
            http_response_code(200);
            echo json_encode([
                'success' => false,
                'error'   => 'get_lineup failed',
                'details' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }


    // Kullanıcıya ait verileri sıfırla (sadece bu kullanıcı)
    if ($action === 'reset_game') {
        try {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM saved_lineups WHERE user_id = ?")->execute([$userId]);
            $pdo->prepare("DELETE FROM game_players  WHERE user_id = ?")->execute([$userId]);
            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        exit;
    }

    // Leaderboard (sadece bu kullanıcının lineup'larından)
    if ($action === 'get_leaderboard') {
        header('Content-Type: application/json; charset=utf-8');
        ini_set('display_errors', 0);
        ini_set('log_errors', 1);
        error_reporting(E_ALL);

        $formationMultipliers = [
            "4231" => [
                "GK"=>[1,0.4,0.4,0.3,0.3,0.15,0.15,0.15,0.05,0.05,0.05],
                "RB"=>[0.3,0.8,0.8,0.9,1.0,0.6,0.6,0.3,0.15,0.15,0.05],
                "CB"=>[0.4,1.0,1.0,0.8,0.8,0.3,0.3,0.2,0.1,0.1,0.05],
                "LB"=>[0.3,0.8,0.8,1.0,0.9,0.6,0.6,0.3,0.15,0.15,0.05],
                "CDM"=>[0.15,0.6,0.6,0.8,0.8,1.0,1.0,0.6,0.35,0.35,0.15],
                "CM"=>[0.15,0.4,0.4,0.5,0.5,1.0,1.0,0.8,0.6,0.6,0.35],
                "CAM"=>[0.10,0.15,0.15,0.3,0.3,0.8,0.8,1.0,0.8,0.8,0.6],
                "RM"=>[0.10,0.15,0.15,0.4,0.4,0.6,0.6,0.8,0.9,1.0,0.6],
                "LM"=>[0.15,0.15,0.15,0.4,0.4,0.6,0.6,0.8,1.0,0.9,0.6],
                "RW"=>[0.05,0.15,0.15,0.3,0.3,0.5,0.5,0.7,0.9,1.0,0.8],
                "LW"=>[0.05,0.15,0.15,0.3,0.3,0.5,0.5,0.7,1.0,0.9,0.8],
                "ST"=>[0.05,0.15,0.15,0.3,0.3,0.5,0.5,0.6,0.7,0.7,1.0],
            ],
            "433" => [
                "GK"=>[1.0,0.4,0.4,0.3,0.3,0.15,0.15,0.15,0.05,0.05,0.05],
                "RB"=>[0.3,0.4,0.4,0.6,1.0,0.7,0.5,0.5,0.15,0.2,0.1],
                "CB"=>[0.4,1.0,1.0,0.6,0.6,0.4,0.3,0.3,0.1,0.1,0.05],
                "LB"=>[0.3,0.4,0.4,1.0,0.6,0.7,0.5,0.5,0.2,0.15,0.1],
                "CDM"=>[0.15,0.4,0.4,0.5,0.5,1.0,0.9,0.9,0.4,0.4,0.2],
                "CM"=>[0.15,0.3,0.3,0.5,0.5,0.9,1.0,1.0,0.5,0.5,0.3],
                "CAM"=>[0.10,0.2,0.2,0.3,0.3,0.6,0.8,0.8,0.8,0.8,0.6],
                "RM"=>[0.05,0.2,0.2,0.3,0.4,0.6,0.6,0.8,0.9,1.0,0.7],
                "LM"=>[0.05,0.2,0.2,0.4,0.3,0.6,0.6,0.8,1.0,0.9,0.7],
                "RW"=>[0.05,0.1,0.1,0.2,0.4,0.5,0.5,0.6,0.9,1.0,0.8],
                "LW"=>[0.05,0.1,0.1,0.4,0.2,0.5,0.5,0.6,1.0,0.9,0.8],
                "ST"=>[0.05,0.1,0.1,0.3,0.3,0.5,0.6,0.6,0.8,0.8,1.0],
            ],
            "442" => [
                "GK"=>[1.0,0.4,0.4,0.3,0.3,0.15,0.15,0.1,0.1,0.05,0.05],
                "RB"=>[0.3,0.4,0.4,0.6,1.0,0.7,0.7,0.3,0.9,0.1,0.1],
                "CB"=>[0.4,1.0,1.0,0.6,0.6,0.4,0.4,0.2,0.2,0.05,0.05],
                "LB"=>[0.3,0.4,0.4,1.0,0.6,0.7,0.7,0.9,0.3,0.1,0.1],
                "CDM"=>[0.15,0.4,0.4,0.5,0.5,1.0,1.0,0.6,0.6,0.2,0.2],
                "CM"=>[0.15,0.3,0.3,0.5,0.5,1.0,1.0,0.8,0.8,0.3,0.3],
                "CAM"=>[0.10,0.2,0.2,0.3,0.3,0.6,0.6,0.9,0.9,0.8,0.8],
                "RM"=>[0.05,0.2,0.2,0.3,0.4,0.6,0.6,0.7,1.0,0.7,0.7],
                "LM"=>[0.05,0.2,0.2,0.4,0.3,0.6,0.6,1.0,0.7,0.7,0.7],
                "RW"=>[0.05,0.1,0.1,0.2,0.3,0.4,0.4,0.6,1.0,0.9,0.9],
                "LW"=>[0.05,0.1,0.1,0.3,0.2,0.4,0.4,1.0,0.6,0.9,0.9],
                "ST"=>[0.05,0.1,0.1,0.3,0.3,0.5,0.5,0.6,0.6,1.0,1.0],
            ],
            "352" => [
                "GK"=>[1.0,0.5,0.5,0.5,0.3,0.3,0.15,0.15,0.1,0.05,0.05],
                "CB"=>[0.4,1.0,1.0,1.0,0.6,0.6,0.3,0.3,0.1,0.05,0.05],
                "RB"=>[0.3,0.4,0.4,0.8,0.7,0.7,0.2,1.0,0.5,0.1,0.1],
                "LB"=>[0.3,0.4,0.8,0.4,0.7,0.7,1.0,0.2,0.5,0.1,0.1],
                "CDM"=>[0.2,0.5,0.5,0.5,1.0,1.0,0.5,0.5,0.4,0.2,0.2],
                "CM"=>[0.15,0.4,0.4,0.4,1.0,1.0,0.6,0.6,0.6,0.3,0.3],
                "CAM"=>[0.10,0.2,0.2,0.2,0.5,0.5,0.7,0.7,1.0,0.8,0.8],
                "LM"=>[0.05,0.1,0.2,0.1,0.4,0.4,1.0,0.8,0.6,0.5,0.5],
                "RM"=>[0.05,0.1,0.1,0.2,0.4,0.4,0.8,1.0,0.6,0.5,0.5],
                "RW"=>[0.05,0.05,0.1,0.1,0.3,0.3,0.6,1.0,0.7,0.9,0.9],
                "LW"=>[0.05,0.05,0.1,0.1,0.3,0.3,1.0,0.6,0.7,0.9,0.9],
                "ST"=>[0.05,0.05,0.1,0.1,0.2,0.2,0.4,0.4,0.8,1.0,1.0],
            ],
            "343" => [
                "GK"=>[1.0,0.5,0.4,0.4,0.3,0.3,0.15,0.15,0.05,0.05,0.05],
                "CB"=>[0.4,1.0,1.0,1.0,0.5,0.5,0.3,0.3,0.1,0.1,0.05],
                "RB"=>[0.3,0.4,0.4,0.8,0.7,0.7,0.3,1.0,0.4,0.3,0.1],
                "LB"=>[0.3,0.4,0.8,0.4,0.7,0.7,1.0,0.3,0.4,0.3,0.1],
                "CDM"=>[0.2,0.5,0.5,0.5,1.0,1.0,0.5,0.5,0.2,0.2,0.1],
                "CM"=>[0.15,0.4,0.4,0.4,1.0,1.0,0.7,0.7,0.4,0.4,0.2],
                "CAM"=>[0.10,0.2,0.2,0.2,0.5,0.5,0.8,0.8,0.9,0.9,1.0],
                "LM"=>[0.05,0.1,0.2,0.1,0.4,0.4,1.0,0.7,0.8,0.5,0.3],
                "RM"=>[0.05,0.1,0.1,0.2,0.4,0.4,0.7,1.0,0.5,0.8,0.3],
                "RW"=>[0.05,0.05,0.1,0.1,0.2,0.2,0.5,0.8,0.6,1.0,0.9],
                "LW"=>[0.05,0.05,0.1,0.1,0.2,0.2,0.8,0.5,1.0,0.6,0.9],
                "ST"=>[0.05,0.05,0.1,0.1,0.2,0.2,0.4,0.4,0.7,0.7,1.0],
            ],
            "532" => [
                "GK"=>[1.0,0.5,0.5,0.5,0.3,0.3,0.2,0.2,0.1,0.05,0.05],
                "CB"=>[0.4,1.0,1.0,1.0,0.6,0.6,0.3,0.3,0.1,0.05,0.05],
                "RB"=>[0.3,0.5,0.4,0.8,0.6,1.0,0.3,0.5,0.2,0.1,0.1],
                "LB"=>[0.3,0.5,0.8,0.4,1.0,0.6,0.5,0.3,0.2,0.1,0.1],
                "CDM"=>[0.2,0.4,0.4,0.4,0.6,0.6,1.0,1.0,0.5,0.2,0.2],
                "CM"=>[0.15,0.3,0.3,0.3,0.6,0.6,1.0,1.0,0.6,0.3,0.3],
                "CAM"=>[0.10,0.2,0.2,0.2,0.5,0.5,0.8,0.8,1.0,0.8,0.8],
                "LM"=>[0.05,0.1,0.2,0.2,1.0,0.6,0.6,0.3,0.4,0.4,0.3],
                "RM"=>[0.05,0.1,0.2,0.2,0.6,1.0,0.3,0.6,0.4,0.4,0.3],
                "RW"=>[0.05,0.1,0.1,0.1,0.3,0.5,0.3,0.5,0.7,0.9,0.9],
                "LW"=>[0.05,0.1,0.1,0.1,0.5,0.3,0.5,0.3,0.7,0.9,0.9],
                "ST"=>[0.05,0.1,0.1,0.1,0.3,0.3,0.4,0.4,0.8,1.0,1.0],
            ]
        ];

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
            // sadece bu kullanıcının lineup'ları
            $stmt = $pdo->prepare("
                SELECT l.username, l.slot_no, l.player_name
                FROM saved_lineups l
                WHERE l.user_id = ?
                ORDER BY l.username, l.slot_no
            ");
            $stmt->execute([$userId]);
            $lineups = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!$lineups) { echo json_encode([]); exit; }

            // formasyonlar (querystring)
            $userFormations = [];
            foreach ($_GET as $key => $value) {
                if (strpos($key, 'formation_') === 0) {
                    $username = urldecode(substr($key, strlen('formation_')));
                    $userFormations[trim($username)] = $value ?: '4231';
                }
            }

            // players meta
            $names = array_values(array_unique(array_map(fn($r) => $r['player_name'], $lineups)));
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

            // puanlama
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

    // --- GET: full_teams (opsiyonel lig filtresi) ---
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

    // --- GET: full_teams lig listesi ---
    if ($action === 'get_full_teams_leagues') {
        $stmt = $pdo->query("SELECT DISTINCT league FROM full_teams ORDER BY league");
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // --- GET: id listesine göre full_teams
    if ($action === 'get_full_teams_by_ids') {
        $idsParam = trim($_GET['ids'] ?? '');
        if ($idsParam === '') { echo json_encode([]); exit; }

        $ids = array_filter(array_unique(array_map(function($v){
            return (int)trim($v);
        }, explode(',', $idsParam))), fn($x) => $x > 0);

        if (empty($ids)) { echo json_encode([]); exit; }

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

// 🧠 POST işlemleri
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // payload array olabilir (save_lineup) ya da object olabilir (tek kayıt)
    $raw = file_get_contents("php://input");
    $input = json_decode($raw, true);

    if ($input === null) { // JSON parse hatası
        http_response_code(400);
        echo json_encode(['error' => 'Geçersiz JSON']);
        exit;
    }

    // Takas işlemleri (bu kullanıcıya ait kayıtlar üzerinde)
    if (($_GET["action"] ?? null) == "process_trades") {
        $data = is_array($input) ? $input : [];
        $summary = [];

        // 1. Korunan oyuncular
        $protectedPlayers = [];
        foreach ($data as $trade) {
            if (!empty($trade["protected_player"])) {
                $protectedPlayers[] = [
                    "username" => $trade["thief"],
                    "player_name" => $trade["protected_player"]
                ];
            }
        }

        // Sadece bu kullanıcının verileri
        $stmtDeleteLineup = $pdo->prepare("
            DELETE FROM saved_lineups 
            WHERE user_id = ? AND username = ? AND player_name = ?
        ");
        $stmtUpdateGamePlayer = $pdo->prepare("
            UPDATE game_players gp 
            JOIN players p ON gp.player_id = p.id 
            SET gp.username = ?
            WHERE gp.user_id = ?
              AND p.player_name = ?
        ");

        foreach ($data as $trade) {
            if (
                empty($trade["thief"]) || empty($trade["target_username"]) ||
                empty($trade["stolen_player"]) || empty($trade["exchange_player"])
            ) {
                $summary[] = ["status" => "fail", "message" => "Eksik bilgi nedeniyle bir takas işlenemedi."];
                continue;
            }
            $thief    = $trade["thief"];
            $target   = $trade["target_username"];
            $stolen   = $trade["stolen_player"];
            $exchange = $trade["exchange_player"];

            $isProtected = false;
            foreach ($protectedPlayers as $prot) {
                if ($prot["player_name"] === $stolen) { $isProtected = true; break; }
            }

            if ($isProtected) {
                $summary[] = [
                    "status" => "fail",
                    "message" => "$thief kullanıcısı, $target'dan $stolen oyuncusunu çalmak istedi ama bu oyuncu koruma altında."
                ];
                continue;
            }

            // Takas uygula (tamamı user_id ile kısıtlı)
            $stmtDeleteLineup->execute([$userId, $target,  $stolen]);
            $stmtUpdateGamePlayer->execute([$thief,  $userId, $stolen]);

            $stmtDeleteLineup->execute([$userId, $thief,   $exchange]);
            $stmtUpdateGamePlayer->execute([$target, $userId, $exchange]);

            $summary[] = [
                "status" => "success",
                "message" => "$thief, $target'dan $stolen oyuncusunu aldı ve $exchange oyuncusunu verdi."
            ];
        }

        echo json_encode(["success" => true, "message" => "Takaslar işlendi.", "summary" => $summary]);
        exit;
    }

    if (($_GET['action'] ?? null) === 'save_lineup') {
        try {
            if (!is_array($input) || empty($input) || empty($input[0]['username'])) {
                http_response_code(400);
                echo json_encode(['error' => 'username ve lineup array gerekli']);
                exit;
            }
            $username = $input[0]['username'];

            $pdo->beginTransaction();

            $pdo->prepare("DELETE FROM saved_lineups WHERE user_id = ? AND username = ?")
                ->execute([$userId, $username]);

            $ins = $pdo->prepare("
                INSERT INTO saved_lineups (user_id, username, slot_no, player_name, player_id, position, team_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($input as $item) {
                if (!isset($item['slot_no'], $item['player_name'])) {
                    $pdo->rollBack();
                    http_response_code(400);
                    echo json_encode(['error' => 'Eksik parametre']);
                    exit;
                }
                $slotNo     = (int)$item['slot_no'];
                $pname      = (string)$item['player_name'];
                $playerId   = isset($item['player_id']) ? (int)$item['player_id'] : null;
                $position   = isset($item['position']) ? (string)$item['position'] : null;
                $teamId     = isset($item['team_id'])   ? (int)$item['team_id']   : null;

                $ins->execute([$userId, $username, $slotNo, $pname, $playerId, $position, $teamId]);
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;
    }


    // Bu kullanıcının game_players’ına oyuncu ekle
    if (($_GET['action'] ?? null) === 'add_game_player') {
        if (!isset($input['username'], $input['team_id'], $input['player_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Eksik parametre', 'received' => $input]);
            exit;
        }
        try {
            $stmt = $pdo->prepare("
                INSERT INTO game_players (user_id, username, team_id, player_id)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$userId, $input['username'], (int)$input['team_id'], (int)$input['player_id']]);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;
    }

    // teams_add -> user_teams’a ekle (team_id = full_teams.team_id)
    if (($_GET['action'] ?? null) === 'teams_add') {
        if (!isset($input['team_id'])) { http_response_code(400); echo json_encode(['error'=>'team_id gerekli']); exit; }
        $teamId = (int)$input['team_id'];

        // full_teams’te var mı?
        $chk = $pdo->prepare("SELECT team_id FROM full_teams WHERE team_id = ?");
        $chk->execute([$teamId]);
        if (!$chk->fetch()) { http_response_code(404); echo json_encode(['error'=>'full_teams içinde bulunamadı']); exit; }

        // kullanıcıya ekle (PK: user_id+team_id)
        $ins = $pdo->prepare("INSERT IGNORE INTO user_teams (user_id, team_id) VALUES (?, ?)");
        $ins->execute([$userId, $teamId]);

        echo json_encode(['success'=>true]);
        exit;
    }

    // teams_add_bulk -> birden fazla team_id’yi user_teams’e ekle
    if (($_GET['action'] ?? null) === 'teams_add_bulk') {
        $teamIds = $input['team_ids'] ?? null;
        if (!is_array($teamIds) || empty($teamIds)) {
            http_response_code(400);
            echo json_encode(['error' => 'team_ids (array) gerekli']); 
            exit;
        }
        $ids = array_values(array_unique(array_map('intval', $teamIds)));

        try {
            $pdo->beginTransaction();
            $ins = $pdo->prepare("INSERT IGNORE INTO user_teams (user_id, team_id) VALUES (?, ?)");
            $count = 0;
            foreach ($ids as $tid) {
                if ($tid <= 0) continue;
                $ins->execute([$userId, $tid]);
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

    // Kullanıcının bir takımı silmesi
    if ($action === 'teams_remove') {
        if (!isset($_GET['id'])) { http_response_code(400); echo json_encode(['error'=>'id (team_id) gerekli']); exit; }
        try {
            $stmt = $pdo->prepare("DELETE FROM user_teams WHERE user_id = ? AND team_id = ?");
            $stmt->execute([$userId, (int)$_GET['id']]);
            echo json_encode(['success'=>true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error'=>$e->getMessage()]);
        }
        exit;
    }

    // Kullanıcının tüm takımlarını silmesi
    if ($action === 'teams_truncate') {
        try {
            $stmt = $pdo->prepare("DELETE FROM user_teams WHERE user_id = ?");
            $stmt->execute([$userId]);
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
