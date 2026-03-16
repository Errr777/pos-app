import { Head, Link, usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';
import {
    ShoppingCart, Warehouse, BarChart3, Package, Users, Zap,
    ArrowRight, CheckCircle2, Store,
} from 'lucide-react';

interface PageProps extends SharedData {
    hasAdmin: boolean;
}

export default function Welcome() {
    const { auth, hasAdmin } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Selamat Datang — POS App">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700" rel="stylesheet" />
            </Head>

            <div className="min-h-screen bg-slate-950 text-white font-[instrument-sans]">

                {/* ── Navbar ──────────────────────────────────────────── */}
                <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                            <Store size={18} className="text-white" />
                        </div>
                        <span className="font-semibold text-lg tracking-tight">POS App</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Dashboard <ArrowRight size={15} />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('login')}
                                    className="text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                >
                                    Masuk
                                </Link>
                                {!hasAdmin && (
                                    <Link
                                        href={route('register')}
                                        className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Daftar Admin
                                    </Link>
                                )}
                            </>
                        )}
                    </div>
                </nav>

                {/* ── Hero ────────────────────────────────────────────── */}
                <section className="relative overflow-hidden py-24 px-6">
                    {/* Background glow blobs */}
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
                            <Zap size={12} />
                            Sistem POS & Manajemen Gudang
                        </div>

                        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                            Kelola Bisnis Anda{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                                Lebih Cepat
                            </span>
                        </h1>

                        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
                            Satu platform untuk kasir, stok gudang, pembelian, dan laporan.
                            Mudah digunakan, aman, dan bisa diakses dari mana saja.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-4">
                            {auth.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-7 py-3.5 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-lg shadow-emerald-500/25"
                                >
                                    Buka Dashboard <ArrowRight size={18} />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={route('login')}
                                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-7 py-3.5 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-lg shadow-emerald-500/25"
                                    >
                                        Mulai Sekarang <ArrowRight size={18} />
                                    </Link>
                                    {!hasAdmin && (
                                        <Link
                                            href={route('register')}
                                            className="flex items-center gap-2 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white px-7 py-3.5 rounded-xl font-semibold text-base transition-all"
                                        >
                                            Buat Akun Admin
                                        </Link>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── Feature Cards ───────────────────────────────────── */}
                <section className="py-20 px-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-14">
                            <h2 className="text-3xl font-bold mb-3">Semua yang Anda Butuhkan</h2>
                            <p className="text-slate-400">Fitur lengkap dalam satu aplikasi terintegrasi</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* POS Card */}
                            <div className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/50 transition-all hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-5 group-hover:bg-emerald-500/25 transition-colors">
                                    <ShoppingCart size={24} className="text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Terminal Kasir (POS)</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-5">
                                    Proses penjualan dengan cepat. Dukungan barcode, multi-metode pembayaran, dan mode offline.
                                </p>
                                <ul className="space-y-2">
                                    {['Kasir multi-outlet', 'Promo & diskon otomatis', 'Mode offline'].map(f => (
                                        <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Warehouse Card */}
                            <div className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-amber-500/50 transition-all hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center mb-5 group-hover:bg-amber-500/25 transition-colors">
                                    <Warehouse size={24} className="text-amber-400" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Manajemen Gudang</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-5">
                                    Pantau stok di setiap gudang secara real-time. Transfer antar gudang dan penyesuaian stok mudah.
                                </p>
                                <ul className="space-y-2">
                                    {['Multi-gudang', 'Transfer & opname stok', 'Alert stok minimum'].map(f => (
                                        <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                                            <CheckCircle2 size={13} className="text-amber-500 shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Reports Card */}
                            <div className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-7 hover:border-violet-500/50 transition-all hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center mb-5 group-hover:bg-violet-500/25 transition-colors">
                                    <BarChart3 size={24} className="text-violet-400" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Laporan & Analitik</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-5">
                                    Lihat performa penjualan, arus kas, dan jam sibuk dalam grafik yang mudah dipahami.
                                </p>
                                <ul className="space-y-2">
                                    {['Laporan penjualan harian', 'Arus kas (cash flow)', 'Peak hours & tren'].map(f => (
                                        <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                                            <CheckCircle2 size={13} className="text-violet-500 shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Extra Features Row ──────────────────────────────── */}
                <section className="py-6 px-6 pb-20">
                    <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: Package, color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: 'Purchase Order' },
                            { icon: Users,   color: 'text-rose-400',  bg: 'bg-rose-500/10',  label: 'Pelanggan & Supplier' },
                            { icon: Zap,     color: 'text-yellow-400',bg: 'bg-yellow-500/10',label: 'Manajemen Promo' },
                            { icon: Store,   color: 'text-indigo-400',bg: 'bg-indigo-500/10',label: 'Multi-Cabang' },
                        ].map(({ icon: Icon, color, bg, label }) => (
                            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                                    <Icon size={18} className={color} />
                                </div>
                                <span className="text-sm text-slate-300 font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── CTA Banner ──────────────────────────────────────── */}
                {!auth.user && (
                    <section className="py-16 px-6">
                        <div className="max-w-3xl mx-auto bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30 rounded-2xl p-10 text-center">
                            <h2 className="text-2xl font-bold mb-3">Siap Mulai?</h2>
                            <p className="text-slate-400 mb-7 text-sm">
                                {hasAdmin
                                    ? 'Masuk ke akun Anda untuk mulai mengelola bisnis.'
                                    : 'Buat akun admin pertama Anda dan mulai dalam hitungan menit.'}
                            </p>
                            <div className="flex flex-wrap justify-center gap-3">
                                <Link
                                    href={route('login')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                                >
                                    Masuk ke Aplikasi
                                </Link>
                                {!hasAdmin && (
                                    <Link
                                        href={route('register')}
                                        className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all"
                                    >
                                        Daftar Sekarang
                                    </Link>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Footer ──────────────────────────────────────────── */}
                <footer className="border-t border-slate-800 py-8 px-6">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
                                <Store size={13} className="text-white" />
                            </div>
                            <span className="font-medium text-slate-400">POS App</span>
                        </div>
                        <p>© {new Date().getFullYear()} POS App. Sistem Kasir & Manajemen Stok.</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
