<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserController extends Controller
{
    private function allowedPerPage(): array
    {
        return [10, 20, 50, 100];
    }

    private function sanitizePerPage(Request $request, int $default = 20): int
    {
        $pp = (int) $request->get('per_page', $default);
        return in_array($pp, $this->allowedPerPage(), true) ? $pp : $default;
    }

    private function sanitizeSortDir(Request $request): string
    {
        return strtolower($request->get('sort_dir', 'asc')) === 'desc' ? 'desc' : 'asc';
    }

    /** Build the full permissions map for a user (all modules, defaulting to false). */
    private function getUserPermissions(User $user): array
    {
        if ($user->role === 'admin') {
            return collect(UserPermission::$modules)
                ->mapWithKeys(fn ($_, $key) => [
                    $key => ['can_view' => true, 'can_write' => true, 'can_delete' => true],
                ])->toArray();
        }

        $stored = UserPermission::where('user_id', $user->id)->get()->keyBy('module');

        return collect(UserPermission::$modules)
            ->mapWithKeys(function ($_, $key) use ($stored) {
                $p = $stored->get($key);
                return [$key => [
                    'can_view'   => $p ? (bool) $p->can_view   : false,
                    'can_write'  => $p ? (bool) $p->can_write  : false,
                    'can_delete' => $p ? (bool) $p->can_delete : false,
                ]];
            })->toArray();
    }

    // -------------------------------------------------------------------------
    // GET: User list
    // -------------------------------------------------------------------------

    public function index(Request $request)
    {
        $perPage  = $this->sanitizePerPage($request);
        $search   = trim((string) $request->get('search', ''));
        $sortDir  = $this->sanitizeSortDir($request);

        $clientToDb = [
            'name'    => 'name',
            'email'   => 'email',
            'role'    => 'role',
            'created' => 'created_at',
        ];
        $requestedSort = (string) $request->get('sort_by', 'name');
        $sortColumn    = $clientToDb[$requestedSort] ?? 'name';

        $query = User::query();

        if ($search !== '') {
            $term = strtolower($search);
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(name) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(email) like ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(role) like ?', ["%{$term}%"]);
            });
        }

        $query->orderBy($sortColumn, $sortDir);

        $users = $query
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn($u) => [
                'id'          => $u->id,
                'name'        => $u->name,
                'email'       => $u->email,
                'role'        => $u->role ?? 'staff',
                'created'     => $u->created_at?->format('Y-m-d'),
                'isMe'        => $u->id === Auth::id(),
                'permissions' => $this->getUserPermissions($u),
            ]);

        return Inertia::render('Users/Index', [
            'users'   => $users,
            'roles'   => User::$roles,
            'modules' => UserPermission::$modules,
            'filters' => array_merge(
                $request->only(['search', 'per_page']),
                ['sort_by' => $requestedSort, 'sort_dir' => $sortDir]
            ),
        ]);
    }

    // -------------------------------------------------------------------------
    // POST: Create user
    // -------------------------------------------------------------------------

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'role'     => ['required', Rule::in(User::$roles)],
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();
        User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'role'     => $data['role'],
            'password' => Hash::make($data['password']),
        ]);

        return $request->wantsJson()
            ? response()->json(['message' => 'User created'], 201)
            : redirect()->route('users.index')->with('success', 'Pengguna berhasil ditambahkan.');
    }

    // -------------------------------------------------------------------------
    // PUT: Update user
    // -------------------------------------------------------------------------

    public function update(Request $request, User $user)
    {
        $validator = Validator::make($request->all(), [
            'name'  => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'role'  => ['required', Rule::in(User::$roles)],
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $data = $validator->validated();
        $user->update([
            'name'  => $data['name'],
            'email' => $data['email'],
            'role'  => $data['role'],
        ]);

        return $request->wantsJson()
            ? response()->json(['message' => 'User updated'])
            : redirect()->route('users.index')->with('success', 'Data pengguna berhasil diperbarui.');
    }

    // -------------------------------------------------------------------------
    // DELETE: Remove user (cannot delete self)
    // -------------------------------------------------------------------------

    public function destroy(Request $request, User $user)
    {
        if ($user->id === Auth::id()) {
            return $request->wantsJson()
                ? response()->json(['error' => 'Tidak bisa menghapus akun sendiri.'], 403)
                : back()->withErrors(['general' => 'Tidak bisa menghapus akun sendiri.']);
        }

        $user->delete();

        return $request->wantsJson()
            ? response()->json(['message' => 'User deleted'])
            : redirect()->route('users.index')->with('success', 'Pengguna berhasil dihapus.');
    }

    // -------------------------------------------------------------------------
    // POST: Reset password
    // -------------------------------------------------------------------------

    public function resetPassword(Request $request, User $user)
    {
        $validator = Validator::make($request->all(), [
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $user->update(['password' => Hash::make($request->password)]);

        return $request->wantsJson()
            ? response()->json(['message' => 'Password reset'])
            : redirect()->route('users.index')->with('success', 'Password berhasil direset.');
    }

    // -------------------------------------------------------------------------
    // POST: Update permissions for a user
    // -------------------------------------------------------------------------

    public function updatePermissions(Request $request, User $user)
    {
        $validator = Validator::make($request->all(), [
            'permissions'            => 'required|array',
            'permissions.*.can_view'   => 'boolean',
            'permissions.*.can_write'  => 'boolean',
            'permissions.*.can_delete' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $request->wantsJson()
                ? response()->json(['errors' => $validator->errors()], 422)
                : back()->withErrors($validator)->withInput();
        }

        $validModules = array_keys(UserPermission::$modules);

        foreach ($request->permissions as $module => $perms) {
            if (!in_array($module, $validModules)) continue;

            $canView   = (bool) ($perms['can_view']   ?? false);
            $canWrite  = (bool) ($perms['can_write']  ?? false);
            $canDelete = (bool) ($perms['can_delete'] ?? false);

            // If write or delete is granted, view must be granted too
            if ($canWrite || $canDelete) $canView = true;

            UserPermission::updateOrCreate(
                ['user_id' => $user->id, 'module' => $module],
                ['can_view' => $canView, 'can_write' => $canWrite, 'can_delete' => $canDelete]
            );
        }

        return $request->wantsJson()
            ? response()->json(['message' => 'Permissions updated'])
            : redirect()->route('users.index')->with('success', 'Hak akses berhasil diperbarui.');
    }
}
