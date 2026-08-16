import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { BarChart3, DatabaseZap, LogOut, Settings2 } from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: BarChart3, label: "Research lab", path: "/" },
  { icon: Settings2, label: "API settings", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <div className="min-h-screen bg-[#0a0e14]" />;
  if (!user) {
    return <div className="min-h-screen bg-[#0a0e14] p-6 text-slate-100 flex items-center justify-center"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101721] p-10 text-center shadow-2xl"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-300 text-slate-950"><DatabaseZap className="h-7 w-7" /></span><p className="mt-7 font-mono text-[10px] tracking-[0.2em] text-lime-300">KGR / RESEARCH LAB</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight">Unlock your keyword edge.</h1><p className="mt-3 text-sm leading-6 text-slate-400">Sign in to use your secure Serper.dev workspace and run live Google USA allintitle research.</p><Button onClick={() => startLogin()} className="mt-8 h-11 w-full bg-lime-300 font-bold text-slate-950 hover:bg-lime-200">Open secure workspace</Button></div></div>;
  }

  return <SidebarProvider><DashboardContent>{children}</DashboardContent></SidebarProvider>;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  return <>
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-[#0d131c]">
      <SidebarHeader className="h-20 border-b border-white/5 px-3">
        <div className="flex h-full items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-300 text-slate-950"><DatabaseZap className="h-4 w-4" /></span><span className="font-extrabold tracking-tight text-slate-100 group-data-[collapsible=icon]:hidden">KGR <span className="text-lime-300">Pro</span></span></div>
      </SidebarHeader>
      <SidebarContent className="px-2 pt-5"><p className="mb-3 px-3 font-mono text-[10px] tracking-[0.16em] text-slate-500 group-data-[collapsible=icon]:hidden">WORKSPACE</p><SidebarMenu>{menuItems.map(item => { const active = item.path === location; return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={active} tooltip={item.label} onClick={() => setLocation(item.path)} className={active ? "h-11 bg-lime-300/10 text-lime-200 hover:bg-lime-300/10" : "h-11 text-slate-400 hover:bg-white/5 hover:text-slate-100"}><item.icon className={active ? "text-lime-300" : ""} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarContent>
      <SidebarFooter className="border-t border-white/5 p-3"><div className="mb-3 flex items-center gap-2 px-2 font-mono text-[10px] text-slate-500 group-data-[collapsible=icon]:justify-center"><span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_rgb(190,242,100)]" /><span className="group-data-[collapsible=icon]:hidden">LIVE GOOGLE / US</span></div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-white/5 group-data-[collapsible=icon]:justify-center"><Avatar className="h-9 w-9 border border-white/10"><AvatarFallback className="bg-white/5 text-xs text-slate-300">{user?.name?.charAt(0).toUpperCase() || "K"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium text-slate-200">{user?.name || "Researcher"}</p><p className="mt-1 truncate text-xs text-slate-500">{user?.email || ""}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 border-white/10 bg-[#151d28] text-slate-200"><DropdownMenuItem onClick={logout} className="cursor-pointer text-rose-300 focus:text-rose-200"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
    </Sidebar>
    <SidebarInset className="bg-[#0a0e14]"><header className="flex h-14 items-center border-b border-white/5 bg-[#0a0e14]/90 px-4 backdrop-blur md:hidden"><SidebarTrigger className="text-slate-300" /><span className="ml-3 text-sm font-bold text-slate-100">KGR Pro</span></header><main className="min-h-screen flex-1">{children}</main></SidebarInset>
  </>;
}
