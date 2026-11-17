<?php
declare(strict_types=1);

namespace App;

final class HttpError extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

/** Tiny router + JSON helpers. */
final class Http
{
    /** @var list<array{string,string,callable}> */
    private array $routes = [];

    public function get(string $pattern, callable $handler): void
    {
        $this->routes[] = ['GET', $pattern, $handler];
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->routes[] = ['POST', $pattern, $handler];
    }

    public function patch(string $pattern, callable $handler): void
    {
        $this->routes[] = ['PATCH', $pattern, $handler];
    }

    public function dispatch(string $method, string $path): void
    {
        $path = '/' . trim($path, '/');
        $allowed = false;
        foreach ($this->routes as [$m, $pattern, $handler]) {
            $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
            if (!preg_match($regex, $path, $match)) {
                continue;
            }
            $allowed = true;
            if ($m !== $method) {
                continue;
            }
            $params = array_filter($match, 'is_string', ARRAY_FILTER_USE_KEY);
            self::json($handler(array_map('urldecode', $params)));
            return;
        }
        throw new HttpError($allowed ? 405 : 404, $allowed ? 'Method not allowed' : 'Not found');
    }

    public static function body(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        $data = json_decode($raw, true);
        return is_array($data) ? $data : $_POST;
    }

    public static function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function cors(): void
    {
        $allowed = array_filter(array_map('trim', explode(',', Env::get('CORS_ORIGINS', '*'))));
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array('*', $allowed, true)) {
            header('Access-Control-Allow-Origin: *');
        } elseif ($origin !== '' && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
        header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key');
        header('Access-Control-Max-Age: 86400');
    }

    public static function requireApiKey(): void
    {
        $key = Env::get('API_KEY');
        if ($key === null) {
            return; // auth disabled
        }
        $given = $_SERVER['HTTP_X_API_KEY'] ?? '';
        if (!hash_equals($key, $given)) {
            throw new HttpError(401, 'Invalid API key');
        }
    }

    public static function required(array $data, array $fields): void
    {
        foreach ($fields as $f) {
            if (!isset($data[$f]) || trim((string) $data[$f]) === '') {
                throw new HttpError(422, "Field '$f' is required");
            }
        }
    }
}
