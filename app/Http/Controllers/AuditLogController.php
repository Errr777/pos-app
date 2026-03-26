<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        if ($user->role !== 'admin') {
            abort(403);
        }

        $dateFrom   = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $dateTo     = $request->get('date_to', now()->format('Y-m-d'));
        $actionGroup = $request->get('action_group', '');
        $userName   = trim((string) $request->get('user_name', ''));

        $query = AuditLog::query()
            ->whereBetween('occurred_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59'])
            ->orderByDesc('occurred_at');

        if ($actionGroup !== '') {
            $prefixMap = [
                'pengguna'   => 'user.',
                'produk'     => 'item.',
                'stok'       => 'stock.',
                'pembelian'  => 'po.',
                'outlet'     => 'outlet.',
                'promosi'    => 'promotion.',
                'role'       => 'role.',
            ];
            $prefix = $prefixMap[$actionGroup] ?? null;
            if ($prefix) {
                $query->where('action', 'like', $prefix . '%');
            }
        }

        if ($userName !== '') {
            $query->whereRaw('LOWER(user_name_snapshot) like ?', ['%' . strtolower($userName) . '%']);
        }

        $logs = $query->paginate(20)->withQueryString()->through(fn($log) => [
            'id'           => hid($log->id),
            'occurredAt'   => $log->occurred_at?->toISOString(),
            'userId'       => hid($log->user_id),
            'userName'     => $log->user_name_snapshot,
            'action'       => $log->action,
            'subjectType'  => $log->subject_type,
            'subjectId'    => hid($log->subject_id),
            'subjectLabel' => $log->subject_label,
            'oldValue'     => $log->old_value,
            'newValue'     => $log->new_value,
            'ipAddress'    => $log->ip_address,
        ]);

        return Inertia::render('AuditLog/Index', [
            'logs'    => $logs,
            'filters' => $request->only(['date_from', 'date_to', 'action_group', 'user_name']),
        ]);
    }
}
