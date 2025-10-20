// src/pages/AddItem.tsx

import { useState } from "react";
import AppLayout from "@/layouts/app-layout";
import { Head, router } from "@inertiajs/react";
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

const categories = ["General", "Special", "Minuman", "Makanan"];

export default function Add_Items() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    stock: "",
    stock_min: "",
    category: categories[0],
    qrcode: "",
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleCategory = (value: string) => {
    setForm((f) => ({ ...f, category: value }));
  };

  const validate = () => {
    const errs: any = {};
    if (!form.name) errs.name = "Nama wajib diisi";
    if (!form.description) errs.description = "Deskripsi wajib diisi";
    if (!form.stock || isNaN(Number(form.stock))) errs.stock = "Stok harus angka";
    if (!form.stock_min || isNaN(Number(form.stock_min))) errs.stock_min = "Stok harus angka";
    if (!form.qrcode) errs.qrcode = "QR Code wajib diisi";
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    alert("Item berhasil ditambahkan! (Simulasi, integrasikan ke backend Anda)");
    router.visit("/items");
  };

  return (
    <AppLayout breadcrumbs={[
      { title: "Dashboard", href: "/dashboard" },
      { title: "Item List", href: "/items" },
      { title: "Tambah Item", href: "/items/add" },
    ]}>
      <Head title="Tambah Item" />
      <div className="max-w-4xl my-10 bg-white dark:bg-background rounded-xl shadow p-6 border border-sidebar-border/60">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.visit("/items")}
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
              {form.qrcode ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(form.qrcode)}`}
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
          <form
            onSubmit={handleSubmit}
            className="flex-1 space-y-4"
            autoComplete="off"
          >
            <div>
              <label className="block mb-1">Nama Item *</label>
              <Input
                name="name"
                placeholder="Nama item"
                value={form.name}
                onChange={handleChange}
                autoFocus
              />
              {errors.name && (
                <div className="text-red-600 text-xs mt-1">{errors.name}</div>
              )}
            </div>
            <div>
              <label className="block mb-1">Deskripsi *</label>
              <Textarea
                name="description"
                placeholder="Deskripsi item"
                value={form.description}
                onChange={handleChange}
              />
              {errors.description && (
                <div className="text-red-600 text-xs mt-1">{errors.description}</div>
              )}
            </div>
            <div>
              <label className="block mb-1">Stok *</label>
              <Input
                name="stock"
                placeholder="Stok (angka)"
                value={form.stock_min}
                onChange={handleChange}
                type="number"
                min={0}
              />
              {errors.stock && (
                <div className="text-red-600 text-xs mt-1">{errors.stock}</div>
              )}
            </div>
            <div>
              <label className="block mb-1">Stok Minimal *</label>
              <Input
                name="stock_min"
                placeholder="Stok Minimal (angka)"
                value={form.stock_min}
                onChange={handleChange}
                type="number"
                min={0}
              />
              {errors.stock_min && (
                <div className="text-red-600 text-xs mt-1">{errors.stock}</div>
              )}
            </div>
            <div>
              <label className="block mb-1">Kategori *</label>
              <Select value={form.category} onValueChange={handleCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-1">QR Code Text *</label>
              <Input
                name="qrcode"
                placeholder="Masukkan text untuk QR code"
                value={form.qrcode}
                onChange={handleChange}
              />
              {errors.qrcode && (
                <div className="text-red-600 text-xs mt-1">{errors.qrcode}</div>
              )}
            </div>
            <div className="pt-4 flex gap-2">
              <Button type="submit">Simpan Item</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.visit("/items")}
              >
                Batal
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}