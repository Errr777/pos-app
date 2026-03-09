// src/pages/AddItem.tsx
import { useEffect } from "react";
import AppLayout from "@/layouts/app-layout";
import { Head, useForm, router, usePage } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

type Kategori = {
  id: number;
  nama: string;
  deskripsi?: string | null;
  [k: string]: any;
};

export default function Add_Items() {
  const { props } = usePage<any>();
  // kategoris is provided from controller (create())
  const kategoris: Kategori[] = props.kategoris ?? [];

  // use Inertia useForm to handle data, errors and processing
  const form = useForm({
    nama: "",
    deskripsi: "",
    stok: "",
    stok_minimal: "",
    harga_beli: "" as string | number,
    harga_jual: "" as string | number,
    // store id_kategori as string (Select uses string values). We'll convert on server if needed.
    id_kategori: "" as string | number | null,
    kategori: "",
    kode_item: "",
  });

  // A sentinel value for the placeholder SelectItem (must be non-empty string)
  const PLACEHOLDER_VALUE = "__none";

  // keep numeric fields as strings while typing
  useEffect(() => {
    if (form.data.stok === null) form.setData("stok", "");
    if (form.data.stok_minimal === null) form.setData("stok_minimal", "");

    // If controller provided categories and no selection yet, optionally prefill the first category
    // (If you prefer to require explicit user choice, skip this.)
    if ((form.data.id_kategori === "" || form.data.id_kategori == null) && kategoris.length > 0) {
      const first = kategoris[0];
      form.setData("id_kategori", String(first.id));
      form.setData("kategori", first.nama);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategoris]);

  const handleCategory = (value: string) => {
    // When placeholder (PLACEHOLDER_VALUE) is selected, clear category
    if (value === PLACEHOLDER_VALUE) {
      form.setData("id_kategori", "");
      form.setData("kategori", "");
      return;
    }

    const id = value ? Number(value) : null;
    const found = kategoris.find((k) => k.id === id) ?? null;
    form.setData("id_kategori", id ?? "");
    form.setData("kategori", found ? found.nama : "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // small client-side checks (server will validate)
    const clientErrors: Record<string, string> = {};
    if (!form.data.nama) clientErrors.nama = "Nama wajib diisi";
    // deskripsi is optional per backend validation
    if (!form.data.stok || isNaN(Number(form.data.stok))) clientErrors.stok = "Stok harus angka";
    if (!form.data.stok_minimal || isNaN(Number(form.data.stok_minimal))) clientErrors.stok_minimal = "Stok minimal harus angka";
    if (!form.data.kode_item) clientErrors.kode_item = "QR Code wajib diisi";

    if (Object.keys(clientErrors).length > 0) {
      // quick UX: show an alert; server errors will be displayed inline from form.errors
      alert("Periksa input. Semua field wajib diisi dan stok harus angka.");
      return;
    }

    // Post to backend. Assumes route('item.store') exists.
    form.post(route("item.store"), {
      onSuccess: () => {
        // Inertia usually follows redirects returned by controller; explicit visit to /items is fine.
        router.visit("/tambah_item");
      },
      onError: () => {
        // server validation errors populate form.errors automatically
        console.warn("Validation failed", form.errors);
      },
    });
  };

  return (
    <AppLayout
      breadcrumbs={[
        { title: "Dashboard", href: "/dashboard" },
        { title: "Item List", href: "/item" },
        { title: "Tambah Item", href: "/tambah_item" },
      ]}
    >
      <Head title="Tambah Item" />
      <div className="max-w-4xl my-10 bg-white dark:bg-background rounded-xl shadow p-6 border border-sidebar-border/60">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.visit("/item")}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Kembali ke Daftar Item
        </Button>

        <h2 className="text-xl font-semibold mb-6">Tambah Item Baru</h2>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: QR Code Preview */}
          <div className="md:w-1/3 flex flex-col items-center justify-start">
            <div className="bg-muted p-4 rounded-lg border w-full flex flex-col bg-slate-100 items-center min-h-[200px]">
              <span className="mb-2 text-black text-sm text-center">Preview QR Code</span>
              {form.data.kode_item ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    String(form.data.kode_item)
                  )}`}
                  alt="QR Preview"
                  className="rounded shadow border"
                  style={{ width: 180, height: 180 }}
                />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-white rounded border text-black text-sm text-center">
                  QR code belum diisi
                </div>
              )}
            </div>
          </div>

          {/* Right: Form */}
          <form onSubmit={handleSubmit} className="flex-1 space-y-4" autoComplete="off">
            <div>
              <label className="block mb-1">Nama Item *</label>
              <Input
                name="nama"
                placeholder="Nama item"
                value={form.data.nama}
                onChange={(e) => form.setData("nama", e.target.value)}
                autoFocus
              />
              {form.errors.nama && <div className="text-red-600 text-xs mt-1">{form.errors.nama}</div>}
            </div>

            <div>
              <label className="block mb-1">Deskripsi</label>
              <Textarea
                name="deskripsi"
                placeholder="Deskripsi item"
                value={form.data.deskripsi}
                onChange={(e) => form.setData("deskripsi", e.target.value)}
              />
              {form.errors.deskripsi && <div className="text-red-600 text-xs mt-1">{form.errors.deskripsi}</div>}
            </div>

            <div>
              <label className="block mb-1">Stok *</label>
              <Input
                name="stok"
                placeholder="Stok (angka)"
                value={String(form.data.stok)}
                onChange={(e) => form.setData("stok", e.target.value)}
                type="number"
                min={0}
              />
              {form.errors.stok && <div className="text-red-600 text-xs mt-1">{form.errors.stok}</div>}
            </div>

            <div>
              <label className="block mb-1">Stok Minimal *</label>
              <Input
                name="stok_minimal"
                placeholder="Stok Minimal (angka)"
                value={String(form.data.stok_minimal)}
                onChange={(e) => form.setData("stok_minimal", e.target.value)}
                type="number"
                min={0}
              />
              {form.errors.stok_minimal && <div className="text-red-600 text-xs mt-1">{form.errors.stok_minimal}</div>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Harga Beli (Rp)</label>
                <Input
                  name="harga_beli"
                  placeholder="0"
                  value={String(form.data.harga_beli)}
                  onChange={(e) => form.setData("harga_beli", e.target.value)}
                  type="number"
                  min={0}
                />
                {form.errors.harga_beli && <div className="text-red-600 text-xs mt-1">{form.errors.harga_beli}</div>}
              </div>
              <div>
                <label className="block mb-1">Harga Jual (Rp)</label>
                <Input
                  name="harga_jual"
                  placeholder="0"
                  value={String(form.data.harga_jual)}
                  onChange={(e) => form.setData("harga_jual", e.target.value)}
                  type="number"
                  min={0}
                />
                {form.errors.harga_jual && <div className="text-red-600 text-xs mt-1">{form.errors.harga_jual}</div>}
              </div>
            </div>

            <div>
              <label className="block mb-1">Kategori *</label>

              {/* Use controller-provided kategoris for dropdown */}
              <Select
                value={form.data.id_kategori ? String(form.data.id_kategori) : PLACEHOLDER_VALUE}
                onValueChange={(val) => handleCategory(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {/* placeholder option uses non-empty sentinel value */}
                  <SelectItem value={PLACEHOLDER_VALUE}>-- Pilih Kategori --</SelectItem>
                  {kategoris.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.errors.kategori && <div className="text-red-600 text-xs mt-1">{form.errors.kategori}</div>}
            </div>

            <div>
              <label className="block mb-1">Kode Item *</label>
              <Input
                name="kode_item"
                placeholder="Masukkan text untuk Kode Item (QR Code)"
                value={form.data.kode_item}
                onChange={(e) => form.setData("kode_item", e.target.value)}
              />
              {form.errors.kode_item && <div className="text-red-600 text-xs mt-1">{form.errors.kode_item}</div>}
            </div>

            <div className="pt-4 flex gap-2">
              <Button type="submit" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Simpan Item"}
              </Button>

              <Button type="button" variant="outline" onClick={() => router.visit("/item")}>
                Batal
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}