<?php
declare(strict_types=1);

// Minimal PSR-4 style autoloader: App\Foo\Bar -> src/Foo/Bar.php (no Composer needed on the host).
spl_autoload_register(function (string $class): void {
    if (strncmp($class, 'App\\', 4) !== 0) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

App\Env::load(dirname(__DIR__) . '/.env');
