<?php
declare(strict_types=1);

/**
 * Murandasi Shop — social / link preview meta for product detail pages.
 * cPanel serves this via .htaccess before the SPA loads so WhatsApp, Facebook,
 * Twitter, etc. receive og:image, og:title, and og:description from MySQL.
 */

header('Content-Type: text/html; charset=UTF-8');

function esc(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function loadEnvFile(string $file): array {
    if (!is_file($file)) return [];
    $out = [];
    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) return [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        $eq = strpos($line, '=');
        if ($eq === false) continue;
        $k = trim(substr($line, 0, $eq));
        $v = trim(substr($line, $eq + 1));
        $v = trim($v, "\"'");
        if ($k !== '') $out[$k] = $v;
    }
    return $out;
}

function envv(string $key, array $env): string {
    $v = getenv($key);
    if ($v !== false && $v !== '') return (string)$v;
    return $env[$key] ?? '';
}

function replaceOrInsert(string $html, string $pattern, string $replacement): string {
    if (@preg_match($pattern, $html) === 1) {
        return (string)preg_replace($pattern, $replacement, $html, 1);
    }
    return str_ireplace('</head>', $replacement . "\n</head>", $html);
}

function siteOrigin(array $env): string {
    $configured = trim(envv('PUBLIC_SITE_URL', $env));
    if ($configured === '') {
        $configured = trim(envv('SITE_URL', $env));
    }
    if ($configured !== '') {
        return rtrim($configured, '/');
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'murandasishop.com';
    return $scheme . '://' . $host;
}

function toAbsolute(string $raw, string $origin): string {
    $s = trim($raw);
    if ($s === '') return '';
    if (preg_match('#^https?://#i', $s) === 1) return $s;
    if ($s[0] !== '/') $s = '/' . $s;
    return $origin . $s;
}

function firstProductImage(array $row, string $origin): string {
    $image = trim((string)($row['image'] ?? ''));
    if ($image === '' && !empty($row['images'])) {
        $decoded = json_decode((string)$row['images'], true);
        if (is_array($decoded) && count($decoded) > 0) {
            $image = trim((string)$decoded[0]);
        }
    }
    if ($image === '') {
        return $origin . '/pwa-512x512.png';
    }
    return toAbsolute($image, $origin);
}

function productDescription(array $row): string {
    $name = trim((string)($row['name'] ?? 'Product'));
    $price = number_format((float)($row['price'] ?? 0), 0, '.', ',');
    $parts = ["Buy {$name} at Murandasi Shop for FRW {$price}."];

    $warranty = trim((string)($row['warranty'] ?? ''));
    $delivery = trim((string)($row['delivery'] ?? ''));
    if ($warranty !== '') $parts[] = $warranty . '.';
    if ($delivery !== '') $parts[] = $delivery . '.';

    $inStock = (int)($row['in_stock'] ?? 1) === 1;
    $parts[] = $inStock ? 'In stock now.' : 'Currently out of stock.';

    return implode(' ', $parts);
}

$defaultTitle = 'Murandasi Shop — Electronics Made Simple';
$defaultDescription = 'Browse phones, laptops, headphones, TVs and more. Simple prices, fast delivery.';

$env = array_merge(
    loadEnvFile(__DIR__ . '/.env'),
    loadEnvFile(__DIR__ . '/../.env'),
    loadEnvFile(dirname(__DIR__) . '/.env')
);

$templatePath = __DIR__ . '/index.html';
if (!is_file($templatePath)) {
    http_response_code(500);
    echo 'index.html not found in document root.';
    exit;
}

$html = (string)file_get_contents($templatePath);
if ($html === '') {
    http_response_code(500);
    echo 'index.html is empty.';
    exit;
}

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?? '/';
$path = trim((string)$path, '/');

$productSlug = null;
if (preg_match('#^product/([^/]+)$#', $path, $matches) === 1) {
    $productSlug = urldecode($matches[1]);
}

// Non-product SPA routes — serve index.html unchanged.
if ($productSlug === null || $productSlug === '') {
    echo $html;
    exit;
}

$dbHost = envv('DB_HOST', $env);
$dbPortVal = envv('DB_PORT', $env);
$dbPort = $dbPortVal !== '' ? (int)$dbPortVal : 3306;
$dbUser = envv('DB_USER', $env);
$dbPass = envv('DB_PASSWORD', $env);
$dbName = envv('DB_NAME', $env);

if ($dbUser === '' || $dbName === '') {
    echo $html;
    exit;
}

mysqli_report(MYSQLI_REPORT_OFF);
$db = @new mysqli($dbHost, $dbUser, $dbPass, $dbName, $dbPort);
if ($db->connect_errno) {
    echo $html;
    exit;
}
$db->set_charset('utf8mb4');

$product = null;
$stmt = $db->prepare(
    'SELECT name, slug, price, image, images, warranty, delivery, in_stock
     FROM products WHERE slug = ? LIMIT 1'
);
if ($stmt) {
    $stmt->bind_param('s', $productSlug);
    $stmt->execute();
    $result = $stmt->get_result();
    $product = $result ? $result->fetch_assoc() : null;
    $stmt->close();
}
$db->close();

if (!$product) {
    echo $html;
    exit;
}

$origin = siteOrigin($env);
$name = trim((string)($product['name'] ?? 'Product'));
$title = $name . ' — Murandasi Shop';
$description = productDescription($product);
$canonical = $origin . '/product/' . rawurlencode((string)$product['slug']);
$image = firstProductImage($product, $origin);
$price = number_format((float)($product['price'] ?? 0), 2, '.', '');

$out = $html;
$out = replaceOrInsert($out, '/<title>[\s\S]*?<\/title>/i', '<title>' . esc($title) . '</title>');
$out = replaceOrInsert(
    $out,
    '/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i',
    '<meta name="description" content="' . esc($description) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i',
    '<meta property="og:type" content="product" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/i',
    '<meta property="og:site_name" content="Murandasi Shop" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i',
    '<meta property="og:title" content="' . esc($title) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i',
    '<meta property="og:description" content="' . esc($description) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i',
    '<meta property="og:image" content="' . esc($image) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i',
    '<meta property="og:url" content="' . esc($canonical) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/i',
    '<meta name="twitter:card" content="summary_large_image" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i',
    '<meta name="twitter:image" content="' . esc($image) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i',
    '<meta name="twitter:title" content="' . esc($title) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i',
    '<meta name="twitter:description" content="' . esc($description) . '" />'
);
$out = replaceOrInsert(
    $out,
    '/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i',
    '<link rel="canonical" href="' . esc($canonical) . '" />'
);

$extra = '<meta property="og:image:alt" content="' . esc($name) . '" />'
    . "\n<meta property=\"product:price:amount\" content=\"" . esc($price) . "\" />"
    . "\n<meta property=\"product:price:currency\" content=\"RWF\" />";
$out = str_ireplace('</head>', $extra . "\n</head>", $out);

echo $out;
