<?php
declare(strict_types=1);

namespace App;

use PDO;

/** PDO wrapper. DB_DRIVER=mysql for production, sqlite (default) for local development. */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }
        $opts = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        if (self::driver() === 'mysql') {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                Env::get('DB_HOST', '127.0.0.1'),
                Env::get('DB_PORT', '3306'),
                Env::get('DB_NAME', 'technothics')
            );
            self::$pdo = new PDO($dsn, Env::get('DB_USER', 'root'), Env::get('DB_PASS', ''), $opts);
        } else {
            $path = Env::get('DB_PATH', dirname(__DIR__) . '/database/technothics.sqlite');
            self::$pdo = new PDO('sqlite:' . $path, null, null, $opts);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
        }
        return self::$pdo;
    }

    public static function driver(): string
    {
        return Env::get('DB_DRIVER', 'sqlite') === 'mysql' ? 'mysql' : 'sqlite';
    }

    /** @return list<array<string,mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public static function one(string $sql, array $params = []): ?array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        $row = $st->fetch();
        return $row === false ? null : $row;
    }

    public static function exec(string $sql, array $params = []): int
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public static function insert(string $table, array $row): int
    {
        $cols = array_keys($row);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $cols),
            implode(', ', array_fill(0, count($cols), '?'))
        );
        self::exec($sql, array_values($row));
        return (int) self::pdo()->lastInsertId();
    }

    /** Value stored in the metrics table (JSON), used for figures that are summaries rather than rows. */
    public static function metric(string $key): array
    {
        $row = self::one('SELECT value FROM metrics WHERE name = ?', [$key]);
        return $row ? json_decode((string) $row['value'], true) : [];
    }
}
