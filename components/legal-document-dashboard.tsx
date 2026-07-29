"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Cloud, Download, Edit3, Eye, FileSpreadsheet, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMPANY_STATUSES, DOCUMENT_CATEGORIES, EMPTY_LEGAL_DATA, RELATION_TYPES, STRUCTURE_STATUSES, normalizeLegalData, type CompanyProfile, type CorporateStructure, type LegalData, type LegalDocument } from "@/lib/legal-data";
import { parseCompanyProfileWorkbook } from "@/lib/company-profile-workbook";

export type LegalPage = "legalCompany" | "legalStructure" | "legalDocuments";
type VerifyPassword = () => Promise<string | null>;
type ProfileDraft = Omit<CompanyProfile, "createdAt" | "updatedAt">;
type StructureDraft = Omit<CorporateStructure, "createdAt" | "updatedAt">;
const profileEmpty = (): ProfileDraft => ({ id: "", companyName: "", brandGroup: "", businessField: "", establishmentDeed: "", amendmentDeed: "", operationStartDate: "", npwp: "", npwpd: "", skpkp: "", nib: "", kbli: "", kemenkumhamApproval: "", director: "", commissioner: "", shareholders: "", status: "Aktif", notes: "", source: "Manual Input" });
const structureEmpty = (): StructureDraft => ({ id: "", parentHolding: "", brandGroup: "", entity: "", relationType: "Holding", ownershipPercentage: "", status: "Aktif", notes: "" });
const documentEmpty = () => ({ documentName: "", category: "Akta Perusahaan", company: "", documentNumber: "", documentDate: "", expiredDate: "", notes: "" });

export function LegalDocumentDashboard({ page, verifyPassword }: { page: LegalPage; verifyPassword: VerifyPassword }) {
  const [data, setData] = useState<LegalData>(EMPTY_LEGAL_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [structure, setStructure] = useState<StructureDraft | null>(null);
  const [documentDraft, setDocumentDraft] = useState<ReturnType<typeof documentEmpty> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const companyFileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try { const response = await fetch("/api/legal-data", { cache: "no-store" }); const payload = await response.json(); setData(normalizeLegalData(payload.legalData)); }
    catch { setError("Data legal belum dapat dimuat."); setData(EMPTY_LEGAL_DATA); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(next = data) {
    const password = await verifyPassword(); if (!password) return false;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/legal-data", { method: "POST", headers: { "Content-Type": "application/json", "x-dashboard-password": password }, body: JSON.stringify({ legalData: next }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Save to Cloud gagal.");
      setData(normalizeLegalData(payload.legalData)); setNotice("legalData berhasil disimpan terpisah ke cloud."); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Save to Cloud gagal."); return false; }
    finally { setSaving(false); }
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!profile?.companyName.trim()) { setError("Nama Perusahaan wajib diisi."); return; }
    const now = new Date().toISOString(); const existing = data.companyProfiles.find((item) => item.id === profile.id);
    const row: CompanyProfile = { ...profile, id: profile.id || `company-${crypto.randomUUID()}`, createdAt: existing?.createdAt || now, updatedAt: now };
    const next = { ...data, companyProfiles: existing ? data.companyProfiles.map((item) => item.id === row.id ? row : item) : [...data.companyProfiles, row] };
    if (await save(next)) setProfile(null);
  }
  async function uploadCompanyProfiles(event: ChangeEvent<HTMLInputElement>) {
    const upload = event.target.files?.[0];
    event.target.value = "";
    if (!upload) return;
    setError(""); setNotice("");
    try {
      const companyProfiles = parseCompanyProfileWorkbook(await upload.arrayBuffer());
      setData((current) => ({ ...current, companyProfiles }));
      setNotice(`${companyProfiles.length} Company Profile berhasil dibaca. Klik Save to Cloud untuk menyimpan.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Format Excel Company Profile tidak sesuai.");
    }
  }
  async function saveStructure(event: FormEvent) {
    event.preventDefault(); if (!structure?.entity.trim()) { setError("Entity / Perusahaan wajib diisi."); return; }
    const now = new Date().toISOString(); const existing = data.corporateStructures.find((item) => item.id === structure.id);
    const row: CorporateStructure = { ...structure, id: structure.id || `structure-${crypto.randomUUID()}`, createdAt: existing?.createdAt || now, updatedAt: now };
    const next = { ...data, corporateStructures: existing ? data.corporateStructures.map((item) => item.id === row.id ? row : item) : [...data.corporateStructures, row] };
    if (await save(next)) setStructure(null);
  }
  async function uploadDocument(event: FormEvent) {
    event.preventDefault(); if (!documentDraft?.documentName.trim() || !file) { setError("Nama Dokumen dan Upload File wajib diisi."); return; }
    const password = await verifyPassword(); if (!password) return;
    const form = new FormData(); Object.entries(documentDraft).forEach(([key, value]) => form.append(key, value)); form.append("file", file);
    setSaving(true); setError("");
    try { const response = await fetch("/api/legal-documents", { method: "POST", headers: { "x-dashboard-password": password }, body: form }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Upload Document gagal."); setData(normalizeLegalData(payload.legalData)); setDocumentDraft(null); setFile(null); setNotice("Dokumen berhasil diupload dan tersimpan ke legalData."); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload Document gagal."); }
    finally { setSaving(false); }
  }
  async function remove(kind: "companyProfiles" | "corporateStructures" | "documents", id: string) {
    if (!confirm("Hapus data legal ini?")) return;
    const next = { ...data, [kind]: data[kind].filter((item) => item.id !== id) };
    await save(next);
  }

  const title = page === "legalCompany" ? "Company Profile" : page === "legalStructure" ? "Corporate Structure" : "Document";
  const subtitle = page === "legalCompany" ? "Informasi profil perusahaan dan dokumen pendukung legalitas." : page === "legalStructure" ? "Struktur perusahaan, brand, entity, dan relasi kepemilikan." : "Upload dan arsip dokumen legal perusahaan.";
  return <section className="space-y-6 p-4 sm:p-6 xl:p-8">
    <input ref={companyFileInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={uploadCompanyProfiles} />
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 font-medium text-slate-600">{subtitle}</p></div><div className="flex flex-wrap gap-2">{page === "legalCompany" && <Button variant="outline" onClick={() => companyFileInput.current?.click()} className="rounded-2xl font-bold"><FileSpreadsheet className="h-4 w-4" />Upload Excel</Button>}<Button variant="outline" disabled={saving} onClick={() => save()} className="rounded-2xl font-bold"><Cloud className="h-4 w-4" />{saving ? "Menyimpan..." : "Save to Cloud"}</Button><Button onClick={() => page === "legalCompany" ? setProfile(profileEmpty()) : page === "legalStructure" ? setStructure(structureEmpty()) : setDocumentDraft(documentEmpty())} className="rounded-2xl bg-blue-600 font-bold hover:bg-blue-700">{page === "legalDocuments" ? <Upload className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{page === "legalCompany" ? "Tambah Company Profile" : page === "legalStructure" ? "Tambah Corporate Structure" : "Upload Document"}</Button></div></div>
    {(notice || data.lastUpdated) && <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm">{notice || "legalData tersimpan terpisah dari taxData dan financeData."}{data.lastUpdated && <span className="ml-2 text-slate-500">Last saved: {new Date(data.lastUpdated).toLocaleString("id-ID")}</span>}</div>}
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {loading ? <Card className="rounded-3xl"><CardContent className="p-10 text-center font-semibold text-slate-500">Memuat legalData...</CardContent></Card> : page === "legalCompany" ? <CompanyContent rows={data.companyProfiles} onEdit={setProfile} onDelete={(id) => remove("companyProfiles", id)} /> : page === "legalStructure" ? <StructureContent rows={data.corporateStructures} onEdit={setStructure} onDelete={(id) => remove("corporateStructures", id)} /> : <DocumentContent rows={data.documents} onDelete={(id) => remove("documents", id)} />}
    {profile && <ProfileModal value={profile} setValue={setProfile} onSubmit={saveProfile} saving={saving} />}
    {structure && <StructureModal value={structure} setValue={setStructure} onSubmit={saveStructure} saving={saving} />}
    {documentDraft && <DocumentModal value={documentDraft} setValue={setDocumentDraft} file={file} setFile={setFile} companies={data.companyProfiles.map((item) => item.companyName)} onSubmit={uploadDocument} saving={saving} />}
  </section>;
}

const StatusBadge = ({ value }: { value: string }) => <Badge className={({ Aktif: "bg-emerald-100 text-emerald-700", Expired: "bg-red-100 text-red-700", "Akan Expired": "bg-orange-100 text-orange-700", "Perlu Update": "bg-yellow-100 text-yellow-800", "Dalam Proses": "bg-blue-100 text-blue-700", "Tidak Aktif": "bg-slate-200 text-slate-700", "Perlu Review": "bg-yellow-100 text-yellow-800" } as Record<string,string>)[value] || "bg-slate-100 text-slate-700"}>{value || "-"}</Badge>;
const Empty = ({ text }: { text: string }) => <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-300 text-center text-sm font-semibold text-slate-500">{text}</div>;
const Actions = ({ edit, remove }: { edit?: () => void; remove: () => void }) => <div className="flex gap-1">{edit && <Button variant="ghost" size="icon" onClick={edit} aria-label="Edit"><Edit3 className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" onClick={remove} aria-label="Hapus" className="text-red-600"><Trash2 className="h-4 w-4" /></Button></div>;

function CompanyContent({ rows, onEdit, onDelete }: { rows: CompanyProfile[]; onEdit: (v: ProfileDraft) => void; onDelete: (id:string)=>void }) {
  const [detail, setDetail] = useState<CompanyProfile | null>(null);
  return <><div className="grid gap-4 sm:grid-cols-3"><Summary icon={Building2} label="Total Perusahaan" value={rows.length}/><Summary icon={Building2} label="Perusahaan Aktif" value={rows.filter(r=>r.status==="Aktif").length}/><Summary icon={FileText} label="Perlu Update" value={rows.filter(r=>r.status==="Perlu Update").length}/></div><DataCard title="Daftar Perusahaan">{!rows.length ? <Empty text="Belum ada Company Profile. Upload Excel atau klik Tambah Company Profile untuk mulai."/> : <Table><TableHeader><TableRow>{["Nama Perusahaan","Brand / Group","Bidang Bisnis","NPWP","NIB","Status","Keterangan","Aksi"].map(h=><TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell className="min-w-56 font-bold">{r.companyName}</TableCell><TableCell>{r.brandGroup||"-"}</TableCell><TableCell className="min-w-56">{r.businessField||"-"}</TableCell><TableCell className="whitespace-pre-line">{r.npwp||"-"}</TableCell><TableCell className="whitespace-pre-line">{r.nib||"-"}</TableCell><TableCell><StatusBadge value={r.status}/></TableCell><TableCell className="min-w-48">{r.notes||"-"}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={()=>setDetail(r)} aria-label="Lihat Detail"><Eye className="h-4 w-4"/></Button><Actions edit={()=>onEdit(r)} remove={()=>onDelete(r.id)}/></div></TableCell></TableRow>)}</TableBody></Table>}</DataCard>{detail && <CompanyDetail value={detail} onClose={()=>setDetail(null)}/>}</>;
}

function CompanyDetail({ value, onClose }: { value: CompanyProfile; onClose: () => void }) {
  const fields = [["Akta Pendirian",value.establishmentDeed],["Akta Perubahan",value.amendmentDeed],["Tanggal Mulai Beroperasi",value.operationStartDate],["NPWPD",value.npwpd],["SKPKP",value.skpkp],["KBLI",value.kbli],["Pengesahan Kemenkumham",value.kemenkumhamApproval],["Direktur",value.director],["Komisaris",value.commissioner],["Pemegang Saham",value.shareholders]];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><div><h2 className="text-xl font-black">{value.companyName}</h2><p className="text-sm font-semibold text-slate-500">Detail Company Profile</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5"/></Button></div><dl className="grid gap-4 p-5 sm:grid-cols-2">{fields.map(([name,content])=><div key={name} className={name==="Pemegang Saham"?"sm:col-span-2":""}><dt className="text-sm font-bold text-slate-500">{name}</dt><dd className="mt-1 whitespace-pre-line font-semibold text-slate-800">{content||"-"}</dd></div>)}</dl></div></div>;
}
function StructureContent({ rows, onEdit, onDelete }: { rows: CorporateStructure[]; onEdit:(v:StructureDraft)=>void; onDelete:(id:string)=>void }) { const groups=useMemo(()=>Array.from(new Set(rows.map(r=>r.parentHolding||r.brandGroup).filter(Boolean))),[rows]); return <><Card className="rounded-3xl"><CardHeader><CardTitle>Struktur Perusahaan</CardTitle></CardHeader><CardContent>{!rows.length?<Empty text="Belum ada struktur perusahaan."/>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{groups.map(group=><div key={group} className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="font-black text-blue-950">{group}</p>{rows.filter(r=>(r.parentHolding||r.brandGroup)===group).map(r=><p key={r.id} className="mt-2 text-sm font-semibold text-slate-600">↳ {r.entity} · {r.relationType}</p>)}</div>)}</div>}</CardContent></Card><DataCard title="Tabel Struktur Corporate">{!rows.length?<Empty text="Belum ada Corporate Structure. Klik Tambah Corporate Structure untuk mulai."/>:<Table><TableHeader><TableRow>{["Parent / Holding","Brand / Group","Entity / Perusahaan","Jenis Relasi","Persentase Kepemilikan","Status","Keterangan","Aksi"].map(h=><TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell>{r.parentHolding||"-"}</TableCell><TableCell>{r.brandGroup||"-"}</TableCell><TableCell className="font-bold">{r.entity}</TableCell><TableCell>{r.relationType}</TableCell><TableCell>{r.ownershipPercentage ? `${r.ownershipPercentage}%` : "-"}</TableCell><TableCell><StatusBadge value={r.status}/></TableCell><TableCell>{r.notes||"-"}</TableCell><TableCell><Actions edit={()=>onEdit(r)} remove={()=>onDelete(r.id)}/></TableCell></TableRow>)}</TableBody></Table>}</DataCard></>; }
function formatDate(value:string){ if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "-"; const [y,m,d]=value.split("-"); return `${d}/${m}/${y}`; }
function DocumentContent({ rows,onDelete }:{rows:LegalDocument[];onDelete:(id:string)=>void}) { return <DataCard title="Arsip Dokumen Legal">{!rows.length?<Empty text="Belum ada dokumen legal. Klik Upload Document untuk mulai."/>:<Table><TableHeader><TableRow>{["Nama Dokumen","Kategori","Perusahaan","Nomor Dokumen","Tanggal Dokumen","Tanggal Expired","Status","File","Keterangan","Source","Aksi"].map(h=><TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell className="font-bold">{r.documentName}</TableCell><TableCell>{r.category}</TableCell><TableCell>{r.company||"-"}</TableCell><TableCell>{r.documentNumber||"-"}</TableCell><TableCell>{formatDate(r.documentDate)}</TableCell><TableCell>{formatDate(r.expiredDate)}</TableCell><TableCell><StatusBadge value={r.status}/></TableCell><TableCell>{r.fileUrl?<div className="flex gap-1"><a href={r.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-slate-50"><FileText className="h-4 w-4"/>Buka</a><a href={`${r.fileUrl}?download=1`} aria-label="Download" className="inline-grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><Download className="h-4 w-4"/></a></div>:"-"}</TableCell><TableCell>{r.notes||"-"}</TableCell><TableCell>{r.source||"Upload Document"}</TableCell><TableCell><Actions remove={()=>onDelete(r.id)}/></TableCell></TableRow>)}</TableBody></Table>}</DataCard>; }
function Summary({icon:Icon,label,value}:{icon:typeof Building2;label:string;value:number}){return <Card className="rounded-3xl"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><Icon className="h-6 w-6"/></div><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div></CardContent></Card>}
function DataCard({title,children}:{title:string;children:React.ReactNode}){return <Card className="overflow-hidden rounded-3xl"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="overflow-x-auto">{children}</CardContent></Card>}
function Modal({title,onClose,onSubmit,saving,children}:{title:string;onClose:()=>void;onSubmit:(e:FormEvent)=>void;saving:boolean;children:React.ReactNode}){return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><h2 className="text-xl font-black">{title}</h2><Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5"/></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div><div className="border-t p-5"><Button disabled={saving} className="rounded-2xl bg-blue-600 font-bold">{saving?"Menyimpan...":"Simpan"}</Button></div></form></div>}
const Field=({label,wide=false,children}:{label:string;wide?:boolean;children:React.ReactNode})=><label className={wide?"sm:col-span-2":""}><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>{children}</label>;
function ProfileModal({value,setValue,onSubmit,saving}:{value:ProfileDraft;setValue:(v:ProfileDraft|null)=>void;onSubmit:(e:FormEvent)=>void;saving:boolean}){const set=(k:keyof ProfileDraft,v:string)=>setValue({...value,[k]:v});const inputs:[[string,keyof ProfileDraft],...Array<[string,keyof ProfileDraft]>]=[["Nama Perusahaan","companyName"],["Brand / Group","brandGroup"],["Bidang Bisnis","businessField"],["Akta Pendirian","establishmentDeed"],["Akta Perubahan","amendmentDeed"],["Tanggal Mulai Beroperasi","operationStartDate"],["NPWP","npwp"],["NPWPD","npwpd"],["SKPKP","skpkp"],["NIB","nib"],["KBLI","kbli"],["Pengesahan Kemenkumham","kemenkumhamApproval"],["Direktur","director"],["Komisaris","commissioner"]];return <Modal title={value.id?"Edit Company Profile":"Tambah Company Profile"} onClose={()=>setValue(null)} onSubmit={onSubmit} saving={saving}>{inputs.map(([l,k])=><Field key={k} label={l}><Input required={k==="companyName"} value={String(value[k]??"")} onChange={e=>set(k,e.target.value)} className="rounded-xl"/></Field>)}<Field label="Status"><Select value={value.status} onChange={e=>set("status",e.target.value)}>{COMPANY_STATUSES.map(v=><option key={v}>{v}</option>)}</Select></Field><Field label="Pemegang Saham" wide><textarea value={value.shareholders} onChange={e=>set("shareholders",e.target.value)} className="min-h-24 w-full rounded-xl border p-3"/></Field><Field label="Keterangan" wide><textarea value={value.notes} onChange={e=>set("notes",e.target.value)} className="min-h-24 w-full rounded-xl border p-3"/></Field></Modal>}
function StructureModal({value,setValue,onSubmit,saving}:{value:StructureDraft;setValue:(v:StructureDraft|null)=>void;onSubmit:(e:FormEvent)=>void;saving:boolean}){const set=(k:keyof StructureDraft,v:string)=>setValue({...value,[k]:v});return <Modal title={value.id?"Edit Corporate Structure":"Tambah Corporate Structure"} onClose={()=>setValue(null)} onSubmit={onSubmit} saving={saving}>{[["Parent / Holding","parentHolding"],["Brand / Group","brandGroup"],["Entity / Perusahaan","entity"]].map(([l,k])=><Field key={k} label={l}><Input required={k==="entity"} value={String(value[k as keyof StructureDraft])} onChange={e=>set(k as keyof StructureDraft,e.target.value)} className="rounded-xl"/></Field>)}<Field label="Jenis Relasi"><Select value={value.relationType} onChange={e=>set("relationType",e.target.value)}>{RELATION_TYPES.map(v=><option key={v}>{v}</option>)}</Select></Field><Field label="Persentase Kepemilikan"><Input type="number" min="0" max="100" value={value.ownershipPercentage} onChange={e=>set("ownershipPercentage",e.target.value)} className="rounded-xl"/></Field><Field label="Status"><Select value={value.status} onChange={e=>set("status",e.target.value)}>{STRUCTURE_STATUSES.map(v=><option key={v}>{v}</option>)}</Select></Field><Field label="Keterangan" wide><textarea value={value.notes} onChange={e=>set("notes",e.target.value)} className="min-h-24 w-full rounded-xl border p-3"/></Field></Modal>}
function DocumentModal({value,setValue,file,setFile,companies,onSubmit,saving}:{value:ReturnType<typeof documentEmpty>;setValue:(v:ReturnType<typeof documentEmpty>|null)=>void;file:File|null;setFile:(v:File|null)=>void;companies:string[];onSubmit:(e:FormEvent)=>void;saving:boolean}){const set=(k:keyof typeof value,v:string)=>setValue({...value,[k]:v});return <Modal title="Upload Document" onClose={()=>setValue(null)} onSubmit={onSubmit} saving={saving}><Field label="Nama Dokumen"><Input required value={value.documentName} onChange={e=>set("documentName",e.target.value)}/></Field><Field label="Kategori"><Select value={value.category} onChange={e=>set("category",e.target.value)}>{DOCUMENT_CATEGORIES.map(v=><option key={v}>{v}</option>)}</Select></Field><Field label="Perusahaan"><Input list="legal-companies" value={value.company} onChange={e=>set("company",e.target.value)}/><datalist id="legal-companies">{companies.map(v=><option key={v} value={v}/>)}</datalist></Field><Field label="Nomor Dokumen"><Input value={value.documentNumber} onChange={e=>set("documentNumber",e.target.value)}/></Field><Field label="Tanggal Dokumen"><Input type="date" value={value.documentDate} onChange={e=>set("documentDate",e.target.value)}/></Field><Field label="Tanggal Expired"><Input type="date" value={value.expiredDate} onChange={e=>set("expiredDate",e.target.value)}/></Field><Field label="Upload File" wide><Input required type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={e=>setFile(e.target.files?.[0]??null)}/>{file&&<p className="mt-2 text-xs font-semibold text-slate-500">{file.name}</p>}</Field><Field label="Keterangan" wide><textarea value={value.notes} onChange={e=>set("notes",e.target.value)} className="min-h-24 w-full rounded-xl border p-3"/></Field></Modal>}
