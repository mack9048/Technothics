<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Controllers\{Accounts, Dashboard, Field, Hr, Inventory, Production, Service, Tech, Warranty};
use App\Http;
use App\HttpError;

Http::cors();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// Works whether the API is served at the domain root or under /api (or a sub-folder).
$path = preg_replace('#^.*?/api(?=/|$)#', '', $path) ?: '/';

$app = new Http();
$app->get('/', fn () => ['name' => 'Technothics API', 'version' => '1.0']);
$app->get('/health', fn () => ['ok' => true, 'db' => App\Db::driver(), 'time' => date(DATE_ATOM)]);

$app->get('/dashboard', fn () => Dashboard::show());
$app->get('/warranty/{serial}', fn ($p) => Warranty::show($p));

$app->get('/production', fn () => Production::show());
$app->post('/batches', fn () => Production::startBatch());

$app->get('/service', fn () => Service::show());
$app->post('/service/tickets', fn () => Service::create());
$app->post('/service/tickets/{code}/approve', fn ($p) => Service::approve($p));
$app->post('/service/tickets/{code}/resend', fn ($p) => Service::resend($p));
$app->post('/service/tickets/{code}/close', fn ($p) => Service::close($p));

$app->get('/field', fn () => Field::show());

$app->get('/inventory', fn () => Inventory::show());
$app->post('/purchase-orders', fn () => Inventory::createPurchaseOrders());
$app->post('/vans/issue', fn () => Inventory::issueKit());

$app->get('/accounts', fn () => Accounts::show());
$app->get('/accounts/profitability', fn () => Accounts::profitability());

$app->get('/hr', fn () => Hr::show());
$app->post('/hr/employees', fn () => Hr::addEmployee());
$app->patch('/hr/leaves/{id}', fn ($p) => Hr::decideLeave($p));

$app->get('/tech/jobs', fn () => Tech::jobs());
$app->get('/tech/jobs/{code}', fn ($p) => Tech::job($p));
$app->post('/tech/jobs/{code}/report', fn ($p) => Tech::report($p));
$app->post('/tech/jobs/{code}/invoice', fn ($p) => Tech::invoice($p));
$app->post('/tech/jobs/{code}/collect', fn ($p) => Tech::collect($p));
$app->get('/tech/onsite/{code}', fn ($p) => Tech::onsite($p));

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        Http::requireApiKey();
    }
    $app->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);
} catch (HttpError $e) {
    Http::json(['error' => $e->getMessage()], $e->status);
} catch (Throwable $e) {
    error_log((string) $e);
    $debug = App\Env::get('APP_DEBUG') === '1';
    Http::json(['error' => $debug ? $e->getMessage() : 'Server error'], 500);
}
