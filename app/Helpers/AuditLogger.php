<?php

namespace App\Helpers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditLogger
{
    /**
     * Log a business-critical action.
     *
     * @param  string      $action        e.g. 'item.sell_price_changed'
     * @param  Model       $subject       Eloquent model — extracts type, id, label automatically
     * @param  array|null  $old           Key fields only (old values)
     * @param  array|null  $new           Key fields only (new values)
     * @param  string|null $subjectLabel  Override the auto-derived label
     */
    public static function log(
        string $action,
        Model  $subject,
        ?array $old = null,
        ?array $new = null,
        ?string $subjectLabel = null
    ): void {
        $isConsole = app()->runningInConsole();
        $user      = $isConsole ? null : Auth::user();

        AuditLog::create([
            'user_id'           => $user?->id,
            'user_name_snapshot'=> $user?->name ?? 'system',
            'action'            => $action,
            'subject_type'      => class_basename($subject),
            'subject_id'        => $subject->getKey(),
            'subject_label'     => $subjectLabel ?? self::deriveLabel($subject),
            'old_value'         => $old,
            'new_value'         => $new,
            'ip_address'        => $isConsole ? null : request()->ip(),
            'occurred_at'       => now()->utc(),
        ]);
    }

    private static function deriveLabel(Model $subject): string
    {
        // Try common label fields in priority order
        foreach (['name', 'nama', 'po_number', 'sale_number', 'title', 'code'] as $field) {
            if (!empty($subject->{$field})) {
                return (string) $subject->{$field};
            }
        }
        return class_basename($subject) . ' #' . $subject->getKey();
    }
}
