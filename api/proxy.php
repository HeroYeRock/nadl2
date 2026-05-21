<?php
// Nadl2 cafe24 proxy server
// App -> cafe24 -> Google Places / Groq

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Nadl2-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$localConfig = __DIR__ . '/config.local.php';
if (file_exists($localConfig)) {
    require_once $localConfig;
}

if (!defined('GOOGLE_PLACES_KEY')) {
    define('GOOGLE_PLACES_KEY', getenv('GOOGLE_PLACES_KEY') ?: 'PUT_GOOGLE_PLACES_KEY_HERE');
}
if (!defined('GROQ_KEY')) {
    define('GROQ_KEY', getenv('GROQ_KEY') ?: 'PUT_GROQ_KEY_HERE');
}
if (!defined('GROQ_MODEL')) {
    define('GROQ_MODEL', getenv('GROQ_MODEL') ?: 'llama-3.1-8b-instant');
}
if (!defined('APP_TOKEN')) {
    define('APP_TOKEN', getenv('APP_TOKEN') ?: 'nadl2_heroyerock_secret');
}

$action = isset($_GET['action']) ? $_GET['action'] : 'ping';

function json_response($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_token() {
    $headerToken = isset($_SERVER['HTTP_X_NADL2_TOKEN']) ? $_SERVER['HTTP_X_NADL2_TOKEN'] : '';
    $queryToken = isset($_GET['token']) ? $_GET['token'] : '';
    $token = $headerToken ?: $queryToken;

    if ($token !== APP_TOKEN) {
        json_response(array('error' => 'invalid_token'), 401);
    }
}

function curl_json($url, $method = 'GET', $body = null, $headers = array()) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $headers[] = 'Content-Type: application/json';
    }

    if ($headers) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }

    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        json_response(array('error' => $error ?: 'request_failed'), 502);
    }

    $data = json_decode($response, true);
    if ($data === null) {
        json_response(array('error' => 'invalid_json_response', 'status' => $status), 502);
    }

    if ($status >= 400) {
        json_response(array('error' => 'upstream_error', 'status' => $status, 'detail' => $data), 502);
    }

    return $data;
}

function google_get($path, $params) {
    $params['key'] = GOOGLE_PLACES_KEY;
    $params['language'] = isset($params['language']) ? $params['language'] : 'ko';
    $url = 'https://maps.googleapis.com/maps/api/place/' . $path . '?' . http_build_query($params);
    return curl_json($url);
}

function output_photo() {
    if (!isset($_GET['ref'])) {
        json_response(array('error' => 'missing_photo_ref'), 400);
    }

    $params = array(
        'maxwidth' => isset($_GET['maxwidth']) ? $_GET['maxwidth'] : '900',
        'photo_reference' => $_GET['ref'],
        'key' => GOOGLE_PLACES_KEY,
    );
    $url = 'https://maps.googleapis.com/maps/api/place/photo?' . http_build_query($params);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $image = curl_exec($ch);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'image/jpeg';
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($image === false || $status >= 400) {
        json_response(array('error' => 'photo_fetch_failed'), 502);
    }

    header('Content-Type: ' . $contentType);
    echo $image;
    exit;
}

function ai_recommend() {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!$body) {
        json_response(array('error' => 'invalid_body'), 400);
    }

    $candidates = isset($body['candidates']) ? $body['candidates'] : array();
    if (!$candidates) {
        json_response(array('picks' => array(), 'reason' => '추천 후보가 없습니다.'));
    }

    $prompt = "다음 여행 후보 중 시간대와 동선에 맞는 상위 3개 index를 골라주세요.\n"
        . "반드시 JSON만 반환하세요. 형식: {\"picks\":[0,1,2],\"reason\":\"한국어 이유 한 문장\"}\n\n"
        . "목적지: " . ($body['destination'] ?? '') . "\n"
        . "지역: " . ($body['region'] ?? '') . "\n"
        . "테마: " . ($body['theme'] ?? '') . "\n"
        . "일차: " . ($body['day'] ?? '') . "\n"
        . "시간대: " . ($body['slot_label'] ?? '') . " " . ($body['slot_time'] ?? '') . "\n"
        . "시간대 설명: " . ($body['slot_desc'] ?? '') . "\n"
        . "이미 확정된 장소: " . ($body['filled_places'] ?? '') . "\n"
        . "후보: " . json_encode($candidates, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $payload = array(
        'model' => GROQ_MODEL,
        'messages' => array(
            array(
                'role' => 'system',
                'content' => '당신은 초보 여행자를 위한 모바일 여행 플래너 AI입니다. 동선, 시간대, 평점, 영업상태를 보고 추천합니다. JSON만 반환합니다.'
            ),
            array('role' => 'user', 'content' => $prompt),
        ),
        'temperature' => 0.25,
        'max_completion_tokens' => 300,
        'response_format' => array('type' => 'json_object'),
    );

    $data = curl_json(
        'https://api.groq.com/openai/v1/chat/completions',
        'POST',
        $payload,
        array('Authorization: Bearer ' . GROQ_KEY)
    );

    $content = $data['choices'][0]['message']['content'] ?? '{}';
    $parsed = json_decode($content, true);
    if (!$parsed) {
        json_response(array('picks' => array(0, 1, 2), 'reason' => '가까운 후보를 우선으로 골랐어요.', 'raw' => $content));
    }

    $rawPicks = isset($parsed['picks']) && is_array($parsed['picks']) ? array_values($parsed['picks']) : array(0, 1, 2);
    $picks = array();
    foreach ($rawPicks as $pick) {
        if (is_int($pick)) {
            $picks[] = $pick;
            continue;
        }

        if (is_string($pick)) {
            $trimmed = trim($pick);
            if (preg_match('/^\d+$/', $trimmed) && strlen($trimmed) > 1) {
                foreach (str_split($trimmed) as $digit) {
                    $picks[] = intval($digit);
                }
            } elseif (is_numeric($trimmed)) {
                $picks[] = intval($trimmed);
            }
        }
    }
    $picks = array_values(array_slice(array_unique(array_filter($picks, function ($pick) use ($candidates) {
        return is_int($pick) && $pick >= 0 && $pick < count($candidates);
    })), 0, 4));
    if (!$picks) {
        $picks = array(0, 1, 2);
    }
    $reason = isset($parsed['reason']) ? $parsed['reason'] : '시간대와 동선에 맞는 후보를 골랐어요.';
    json_response(array('picks' => $picks, 'reason' => $reason));
}

if ($action !== 'ping') {
    require_token();
}

switch ($action) {
    case 'ping':
        json_response(array(
            'status' => 'ok',
            'service' => 'nadl2-proxy',
            'google_key' => GOOGLE_PLACES_KEY !== 'PUT_GOOGLE_PLACES_KEY_HERE',
            'groq_key' => GROQ_KEY !== 'PUT_GROQ_KEY_HERE',
            'model' => GROQ_MODEL,
        ));
        break;

    case 'autocomplete':
        json_response(google_get('autocomplete/json', array(
            'input' => isset($_GET['input']) ? $_GET['input'] : '',
            'location' => isset($_GET['location']) ? $_GET['location'] : null,
            'radius' => isset($_GET['radius']) ? $_GET['radius'] : null,
        )));
        break;

    case 'place_detail':
        json_response(google_get('details/json', array(
            'place_id' => isset($_GET['place_id']) ? $_GET['place_id'] : '',
            'fields' => 'place_id,name,formatted_address,geometry,rating,price_level,opening_hours,photos,types',
        )));
        break;

    case 'nearby':
        json_response(google_get('nearbysearch/json', array(
            'location' => isset($_GET['location']) ? $_GET['location'] : '',
            'radius' => isset($_GET['radius']) ? $_GET['radius'] : '1200',
            'type' => isset($_GET['type']) ? $_GET['type'] : 'tourist_attraction',
        )));
        break;

    case 'text_search':
        json_response(google_get('textsearch/json', array(
            'query' => isset($_GET['query']) ? $_GET['query'] : '',
            'location' => isset($_GET['location']) ? $_GET['location'] : null,
            'radius' => isset($_GET['radius']) ? $_GET['radius'] : null,
        )));
        break;

    case 'photo':
        output_photo();
        break;

    case 'ai_recommend':
        ai_recommend();
        break;

    default:
        json_response(array('error' => 'unknown_action'), 404);
}
