"use client";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../lib/utils";
import { BookOpen, Building2, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

const TYPE_LABELS = { SUPPLIER: "Tedarikçi", LAB: "Laboratuvar", EXTERNAL_INSTITUTION: "Kurum", VENDOR: "Satıcı", DOCTOR: "Doktor", PERSONNEL: "Personel", HEALTH_AGENCY: "Sağlık Kurumu", OPERATING_EXPENSE: "İşletme Gideri", MEDICAL: "Medikal", BANK: "Banka", CASH: "Kasa", OTHER: "Diğer" };

export default function FinancePreAccountingPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);
    const fetchData = async () => {
        try { setLoading(true); const res = await fetch("/api/current-accounts/stats/pre-accounting"); const d = await res.json(); setData(d); } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div>;
    if (!data) return <div className="p-8 text-center text-muted-foreground">Veri yüklenemedi</div>;

    return (
        <div className="space-y-6">
            <div><h2 className="text-2xl font-bold tracking-tight">Ön Muhasebe</h2><p className="text-xs text-muted-foreground mt-0.5">Hesap grubu bazlı finansal özet</p></div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="glass-effect shadow-xl border-0"><CardContent className="p-5"><div className="flex items-center gap-3 mb-2"><div className="p-2 bg-emerald-500/10 rounded-xl"><ArrowUpRight className="h-5 w-5 text-emerald-600" /></div><p className="text-sm font-medium text-muted-foreground">Toplam Borç</p></div><div className="text-2xl font-bold">{formatCurrency(data.stats?.grandTotalDebit || 0)}</div></CardContent></Card>
                <Card className="glass-effect shadow-xl border-0"><CardContent className="p-5"><div className="flex items-center gap-3 mb-2"><div className="p-2 bg-orange-500/10 rounded-xl"><ArrowDownRight className="h-5 w-5 text-orange-600" /></div><p className="text-sm font-medium text-muted-foreground">Toplam Alacak</p></div><div className="text-2xl font-bold">{formatCurrency(data.stats?.grandTotalCredit || 0)}</div></CardContent></Card>
                <Card className="glass-effect shadow-xl border-0"><CardContent className="p-5"><div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-500/10 rounded-xl"><Scale className="h-5 w-5 text-blue-600" /></div><p className="text-sm font-medium text-muted-foreground">Bakiye</p></div><div className="text-2xl font-bold">{formatCurrency(data.stats?.grandBalance || 0)}</div><p className="text-xs text-muted-foreground mt-1">{data.stats?.accountCount || 0} hesap</p></CardContent></Card>
            </div>

            <div className="space-y-4">
                {(data.groups || []).map(group => (
                    <Card key={group.type} className="glass-effect shadow-xl border-0">
                        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{TYPE_LABELS[group.type] || group.type}<span className="text-xs text-muted-foreground ml-auto">{group.accounts.length} hesap</span></CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/20"><tr>
                                    <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hesap Adı</th>
                                    <th className="py-2 px-4 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Borç</th>
                                    <th className="py-2 px-4 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Alacak</th>
                                    <th className="py-2 px-4 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Bakiye</th>
                                </tr></thead>
                                <tbody className="divide-y divide-border/20">
                                    {group.accounts.map(a => (
                                        <tr key={a.id} className="hover:bg-muted/5"><td className="py-2 px-4 font-medium"><Link to={`/finance/current-accounts/${a.id}`} className="text-primary hover:underline">{a.name}</Link></td>
                                            <td className="py-2 px-4 text-right">{formatCurrency(a.totalDebit)}</td>
                                            <td className="py-2 px-4 text-right">{formatCurrency(a.totalCredit)}</td>
                                            <td className={`py-2 px-4 text-right font-bold ${a.balance > 0 ? 'text-emerald-600' : a.balance < 0 ? 'text-orange-600' : ''}`}>{formatCurrency(Math.abs(a.balance))}{a.balance < 0 ? ' (A)' : a.balance > 0 ? ' (B)' : ''}</td></tr>
                                    ))}
                                    <tr className="bg-muted/10 font-bold"><td className="py-2 px-4">TOPLAM</td><td className="py-2 px-4 text-right">{formatCurrency(group.totalDebit)}</td><td className="py-2 px-4 text-right">{formatCurrency(group.totalCredit)}</td><td className="py-2 px-4 text-right">{formatCurrency(Math.abs(group.balance))}</td></tr>
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
