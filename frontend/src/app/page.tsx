'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearch } from '@/context/SearchContext';
import { usePathname, useRouter } from 'next/navigation';
import SearchBar from '@/components/SearchBarNew';
import ChatBlockRenderer from '@/components/chat-blocks/ChatBlockRenderer';
import RecipeMarkdown from '@/components/RecipeMarkdown';

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
type ChatBlock = {
  block_type: 'text' | 'recipe' | 'video' | 'ad' | 'cta';
  content_json: Record<string, unknown>;
  display_order?: number;
  id?: string | number;
};
export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; id?: number; recipe?: Record<string, unknown>; blocks?: ChatBlock[]; isLoading?: boolean; error?: string };
type ChatApiResponse = {
  chat_id: number;
  messages: Array<{ role: 'user'; content: string } | { role: 'assistant'; recipe: Record<string, unknown>; blocks?: ChatBlock[] }>;
};
type RecentRecipe = { recipe_key: string; title: string; cuisine: string; difficulty: string; estimated_time: string; tags: string[] };

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const CUISINE_EMOJI: Record<string, string> = {
  indian:'🇮🇳', italian:'🇮🇹', chinese:'🇨🇳', mexican:'🌮',
  american:'🍔', thai:'🇹🇭', japanese:'🇯🇵', mediterranean:'🫒',
  french:'🇫🇷', korean:'🇰🇷', greek:'🇬🇷', turkish:'🇹🇷',
};

const cuisineEmoji = (c:string) => Object.entries(CUISINE_EMOJI).find(([k]) => (c||'').toLowerCase().includes(k))?.[1] ?? '🍽️';

function getToken(): string | null {
  try { return typeof window !== 'undefined' ? localStorage.getItem('gharka_token') : null; }
  catch { return null; }
}

/* ═══════════════════════════════════════════════════
   CHEF LOADING CARD
═══════════════════════════════════════════════════ */
const CHEF_MSGS = [
  {icon:'🧅',text:'Gathering fresh ingredients…'},{icon:'🔪',text:'Chopping and prepping…'},
  {icon:'🫕',text:'Heating up the pan…'},{icon:'🌿',text:'Adding a pinch of spice…'},
  {icon:'👨‍🍳',text:'Your AI chef is cooking…'},{icon:'🍲',text:'Simmering the flavours…'},
  {icon:'⏲️',text:'Almost ready, hang tight…'},{icon:'✨',text:'Putting the finishing touches…'},
];
function ChefLoadingCard() {
  const [step, setStep] = useState(0);
  useEffect(()=>{const t=setInterval(()=>setStep(s=>(s+1)%CHEF_MSGS.length),1800);return()=>clearInterval(t);},[]);
  const { icon, text } = CHEF_MSGS[step];
  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div className="chef-icon-pulse" style={{ width:42, height:42, borderRadius:10, background:'var(--accent-alpha-15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <p className="chef-text-fade" style={{ fontSize:14, color:'var(--text-primary)', fontWeight:500, margin:0 }}>{text}</p>
          <div style={{ marginTop:8, height:3, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
            <div className="chef-progress-bar" style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,var(--claude-orange),#C45E3A)' }}/>
          </div>
        </div>
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          {[0,150,300].map(d=>(
            <span key={d} style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', opacity:0.65, display:'block', animation:`gkBounce 0.9s ${d}ms infinite ease-in-out` }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   RECIPE CARD — thin wrapper → RecipeMarkdown
═══════════════════════════════════════════════════ */
function SingleRecipeCard({ recipe, index }: { recipe:Record<string,any>; index?:number }) {
  const cached = !!(recipe.cached === true || recipe.from_cache === true);
  return <RecipeMarkdown recipe={recipe} cached={cached} index={index} />;
}

function RecipeJsonCard({ recipe }: { recipe:Record<string,any> }) {
  if (Array.isArray(recipe.recipes) && recipe.recipes.length > 0)
    return <div style={{display:'flex',flexDirection:'column',gap:32}}>{recipe.recipes.map((r:any,i:number) => <SingleRecipeCard key={i} recipe={r} index={i}/>)}</div>;
  return <SingleRecipeCard recipe={recipe}/>;
}

/* ═══════════════════════════════════════════════════
   THEME TOGGLE — sun/moon pill button in header
═══════════════════════════════════════════════════ */
function ThemeToggle() {
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  useEffect(() => {
    const saved = localStorage.getItem('gharka_theme') as 'dark'|'light'|null;
    if (saved) { setTheme(saved); document.documentElement.setAttribute('data-theme', saved); }
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('gharka_theme', next);
  };
  return (
    <button onClick={toggle} title={`Switch to ${theme==='dark'?'light':'dark'} mode`} style={{
      display:'flex', alignItems:'center', gap:7, padding:'6px 12px 6px 8px',
      borderRadius:999, border:'1px solid var(--border)', background:'var(--bg-elevated)',
      color:'var(--text-secondary)', fontSize:12, fontWeight:600, fontFamily:'inherit',
      cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap', flexShrink:0,
    }}
    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent-alpha-30)';(e.currentTarget as HTMLElement).style.color='var(--accent)';}}
    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
      <span style={{fontSize:16}}>{theme==='dark'?'☀️':'🌙'}</span>
      <span className="theme-label" style={{display:'none'}}>{theme==='dark'?'Light mode':'Dark mode'}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════ */
export default function Home() {
  const pathname = usePathname();
  const router   = useRouter();
  const apiBase  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';

  const [message,       setMessage]       = useState('');
  const [loading,       setLoading]       = useState(false);
  const [chatId,        setChatId]        = useState<number|null>(null);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [drawerOpen,    setDrawerOpen]    = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [recentChats,   setRecentChats]   = useState<{chat_id:number;title:string}[]>([]);
  const [providers,     setProviders]     = useState<{id:string;label:string}[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string|null>(null);
  const [videos,        setVideos]        = useState<any[]>([]);
  const [playingUrl,    setPlayingUrl]    = useState<string|null>(null);
  const [recentRecipes, setRecentRecipes] = useState<RecentRecipe[]>([]);
  const [isStreaming,   setIsStreaming]   = useState(false);
  const [streamReady,   setStreamReady]  = useState(false);
  const [isSaving,      setIsSaving]     = useState(false);

  const [showAuth,     setShowAuth]     = useState(false);
  const [authView,     setAuthView]     = useState<'login'|'register'|'reset'|'reset-verify'>('login');
  const [authEmail,    setAuthEmail]    = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone,    setAuthPhone]    = useState('');
  const [authUserType, setAuthUserType] = useState('');
  const [authChefSlug, setAuthChefSlug] = useState('');
  const [chefSlugStatus, setChefSlugStatus] = useState<'idle'|'checking'|'available'|'taken'|'invalid'|'error'>('idle');
  const [authOtp,      setAuthOtp]      = useState('');
  const [authNewPassword, setAuthNewPassword] = useState('');
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authError,    setAuthError]    = useState('');
  const [userName,     setUserName]     = useState<string|null>(null);
  const [userEmailDisplay, setUserEmailDisplay] = useState<string|null>(null);
  const [userType,     setUserType]     = useState<string|null>(null);
  const [profileMenuOpen,  setProfileMenuOpen]  = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const seqMapRef = useRef<Record<string,number>>({});
  const { createChatSession } = useSearch();

  const uniqueRecent = React.useMemo(() => {
    // Deduplicate by recipe_key
    const seen = new Set<string>();
    const deduped = recentRecipes.filter(r => {
      const k = r?.recipe_key || '';
      if (!k || seen.has(k)) return false;
      seen.add(k); return true;
    });
    // Fisher-Yates shuffle so each page load shows different 2
    const shuffled = [...deduped];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 2);
  }, [recentRecipes]);

  useEffect(()=>{
    try {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q) setMessage(decodeURIComponent(q));
    } catch {}
  }, []);

  useEffect(()=>{fetch(`${apiBase}/recipes/recent?limit=20`).then(r=>r.ok?r.json():null).then(j=>setRecentRecipes(Array.isArray(j?.recipes)?j.recipes:[])).catch(()=>{});},[apiBase]);
  useEffect(()=>{fetch(`${apiBase}/providers?feature=ai_recipe`).then(r=>r.ok?r.json():null).then(j=>{if(Array.isArray(j?.providers)){setProviders(j.providers);setSelectedProvider(j.default||j.providers[0]?.id||null);}}).catch(()=>{});},[apiBase]);

  const fetchChats = async () => {
    const t=getToken(); if(!t)return;
    const r=await fetch(`${apiBase}/chats`,{headers:{Authorization:`Bearer ${t}`}}).catch(()=>null);
    if(r?.ok){const j=await r.json();setRecentChats(Array.isArray(j?.chats)?j.chats:[]);}
  };
  useEffect(()=>{if(getToken())fetchChats();const t=setTimeout(()=>{if(getToken())fetchChats();},500);return()=>clearTimeout(t);},[]);

  useEffect(()=>{
    try{const t=getToken();if(!t)return;
    fetch(`${apiBase}/auth/me`,{headers:{Authorization:`Bearer ${t}`}}).then(r=>r.ok?r.json():null).then(j=>{
      if(j?.full_name){setUserName(j.full_name);localStorage.setItem('gharka_user_name',j.full_name);}
      if(j?.email){setUserEmailDisplay(j.email);localStorage.setItem('gharka_user_email',j.email);}
      if(j?.user_type){setUserType(j.user_type);localStorage.setItem('gharka_user_type',j.user_type);}
    }).catch(()=>{setUserName(localStorage.getItem('gharka_user_name'));setUserEmailDisplay(localStorage.getItem('gharka_user_email'));setUserType(localStorage.getItem('gharka_user_type'));});}catch{}
  },[apiBase]);

  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'});},[messages]);

  useEffect(()=>{
    const h=async(ev:any)=>{const title=ev?.detail?.title||'';if(!title||!chatId)return;try{const t=getToken();const r=await fetch(`${apiBase}/chat/${chatId}/video_search`,{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:`Bearer ${t}`}:{})},body:JSON.stringify({title})});if(r.ok){const j=await r.json();if(j?.messages)setMessages(j.messages);setTimeout(()=>scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'}),100);}}catch{}};
    window.addEventListener('requestVideoSearch',h);return()=>window.removeEventListener('requestVideoSearch',h);
  },[apiBase,chatId]);

  /* SSE */
  useEffect(()=>{
    if(!chatId||!streamReady)return;
    const token=getToken();if(!token)return;
    const es=new EventSource(`${apiBase}/chat/${chatId}/stream?token=${encodeURIComponent(token)}`);
    setIsStreaming(true);
    es.addEventListener('snapshot',(e:MessageEvent)=>{try{seqMapRef.current={};const s=JSON.parse(e.data);const m=Array.isArray(s)?s:s?.messages??[];if(m.length)setMessages(m);}catch{}});
    es.addEventListener('message',(e:MessageEvent)=>{
      try{
        const ev=JSON.parse(e.data);if(!ev||ev.type!=='token'||ev.source!=='llm')return;
        const{text:tt,block_id:bid,seq,message_id:mid}=ev;const key=`${mid??'m'}:${bid??'b'}`;
        if(typeof seq==='number'){const l=seqMapRef.current[key]??-1;if(seq<=l)return;seqMapRef.current[key]=seq;}
        setMessages(prev=>{
          const c=[...prev];let mi=mid!=null?c.findIndex((m:any)=>m.id===mid):-1;if(mi===-1)mi=c.map(m=>m.role).lastIndexOf('assistant');
          if(mi===-1)return[...c,{role:'assistant',id:mid,recipe:{},blocks:[{block_type:'text',content_json:{text:tt},display_order:1,id:bid}]} as any];
          const msg={...c[mi]} as any;const bl=Array.isArray(msg.blocks)?[...msg.blocks]:[];
          let bi=bid!=null?bl.findIndex((b:any)=>b.id===bid||b.block_id===bid):-1;if(bi===-1)bi=bl.findIndex((b:any)=>b.block_type==='text');
          if(bi===-1){bl.push({block_type:'text',content_json:{text:tt},display_order:1,id:bid});}
          else{const b={...bl[bi]};b.content_json={...b.content_json,text:((b.content_json?.text as string)||'')+tt};bl[bi]=b;}
          msg.blocks=bl;c[mi]=msg;return c;
        });
      }catch{}
    });
    es.addEventListener('done',()=>{
      es.close();setStreamReady(false);setIsStreaming(false);setIsSaving(true);seqMapRef.current={};
      const t=getToken();if(t&&chatId){fetch(`${apiBase}/chat/${chatId}`,{headers:{Authorization:`Bearer ${t}`}}).then(r=>r.ok?r.json():null).then(j=>{if(j?.messages)setMessages(j.messages);setIsSaving(false);}).catch(()=>setIsSaving(false));}else setIsSaving(false);
    });
    es.onerror=()=>{es.close();setIsStreaming(false);};
    return()=>{es.close();setIsStreaming(false);};
  },[chatId,streamReady,apiBase]);

  const loadChat=async(id:number)=>{const t=getToken();if(!t){setShowAuth(true);return;}const r=await fetch(`${apiBase}/chat/${id}`,{headers:{Authorization:`Bearer ${t}`}}).catch(()=>null);if(r?.ok){const j=await r.json();setChatId(j.chat_id);setMessages(j.messages??[]);setMobileDrawerOpen(false);}};

  const sendMessage=async(text?:string,mode?:'Text'|'Video',module?:string)=>{
    const token=getToken();if(!token){setShowAuth(true);return;}
    const trimmed=(text??message).trim();
    // Only block if actively fetching (POST in-flight). Streaming alone never blocks the button.
    if(!trimmed||loading)return;
    // Clear input immediately so user can type next message right away
    setMessage('');
    setLoading(true);
    try{
      if(mode==='Video'){
        const r=await fetch(`${apiBase}/youtube?title=${encodeURIComponent(trimmed)}&limit=2`,{headers:{Authorization:`Bearer ${token}`}});
        if(!r.ok)throw new Error();
        setVideos((await r.json()).slice?.(0,2)??[]);
        return;
      }
      setVideos([]);
      setMessages(prev=>[...prev,{role:'user',content:trimmed},{role:'assistant',isLoading:true}]);
      const q=module??selectedProvider;
      const r=await fetch(`${apiBase}/chat${q?`?module=${encodeURIComponent(q)}`:''}`,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({chat_id:chatId??null,message:trimmed,include_videos:false})
      });
      if(!r.ok){
        if(r.status===401){localStorage.removeItem('gharka_token');setShowAuth(true);throw new Error('Auth');}
        throw new Error(`${r.status}`);
      }
      const json=await r.json() as ChatApiResponse;
      setChatId(json.chat_id);
      setMessages(json.messages);
      // Unlock input NOW — before streaming starts so user can send next message
      setLoading(false);
      // Start SSE stream only if LLM is generating
      if(r.headers.get('x-llm-generation')==='true'||(q??'').startsWith('ollama')){
        setStreamReady(true);
      }
      fetchChats().catch(()=>{});
    }catch(err){
      const em=err instanceof Error?err.message:'Unknown error';
      setMessages(prev=>{
        const n=[...prev];
        const l=n[n.length-1];
        if(l?.role==='assistant'&&'isLoading' in l&&l.isLoading)n[n.length-1]={...l,isLoading:false,error:em};
        return n;
      });
    }finally{
      setLoading(false); // always unlock, even on error
    }
  };

  // Helper: extract a readable error message from a fetch Response
  const _getApiError = async (r: Response): Promise<string> => {
    try {
      const j = await r.json();
      if (Array.isArray(j?.detail)) {
        return j.detail.map((d: any) => d?.msg || d?.message || JSON.stringify(d)).join('\n');
      }
      if (typeof j?.detail === 'string') return j.detail;
      if (typeof j?.message === 'string') return j.message;
    } catch {}
    return `Error ${r.status}`;
  };

  // Basic email format check (must have @ and a dot after @)
  const _isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const loginUser=async()=>{
    const email = authEmail.trim();
    if(!email||!authPassword){alert('Enter email and password');return;}
    if(!_isValidEmail(email)){alert('Please enter a valid email address (e.g. user@example.com)');return;}
    setAuthLoading(true);
    try{
      const r=await fetch(`${apiBase}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:authPassword})});
      if(!r.ok){const msg=await _getApiError(r);throw new Error(msg);}
      const j=await r.json();
      if(j?.token){
        localStorage.setItem('gharka_token',j.token);
        localStorage.setItem('gharka_user_email',email);
        try{const me=await fetch(`${apiBase}/auth/me`,{headers:{Authorization:`Bearer ${j.token}`}});if(me.ok){const mj=await me.json();if(mj?.full_name){localStorage.setItem('gharka_user_name',mj.full_name);setUserName(mj.full_name);}if(mj?.user_type){setUserType(mj.user_type);localStorage.setItem('gharka_user_type',mj.user_type);}}}catch{}
        setUserEmailDisplay(email);setShowAuth(false);
        try{const id=await createChatSession();if(id)setChatId(id);setMessages([]);}catch{}
        fetchChats().catch(()=>{});
      }
    }
    catch(err){alert('Login failed: '+(err instanceof Error ? err.message : 'Check your credentials'));}
    finally{setAuthLoading(false);}
  };

  const registerUser=async()=>{
    const fullName = authFullName.trim();
    const email    = authEmail.trim();
    const phone    = authPhone.trim()||null;
    setAuthError('');
    if(!email||!fullName||!authPassword){setAuthError('Please fill in all required fields.');return;}
    if(!_isValidEmail(email)){setAuthError('Please enter a valid email address (e.g. user@example.com).');return;}
    if(authPassword.length < 6){setAuthError('Password must be at least 6 characters.');return;}
    if(!authUserType){setAuthError('Please select a role.');return;}
    if(phone && !/^\+?[\d\s\-().]{7,15}$/.test(phone)){setAuthError('Please enter a valid phone number (7–15 digits).');return;}
    if((authUserType==='Chef'||authUserType==='Restaurant/Foodcourt') && chefSlugStatus!=='available'){setAuthError('Please choose an available profile name.');return;}
    setAuthLoading(true);
    try{
      const r=await fetch(`${apiBase}/auth/register`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({full_name:fullName,email,phone,user_type:authUserType,password:authPassword,chef_slug:(authUserType==='Chef'||authUserType==='Restaurant/Foodcourt')?normalizeSlug(authChefSlug)||undefined:undefined})
      });
      if(!r.ok){
        const msg = await _getApiError(r);
        setAuthError(msg);
        return;
      }
      // Registration succeeded — now log in
      try{await loginUser();}catch{/* loginUser shows its own error */}
    }catch(err){
      setAuthError('Registration failed: '+(err instanceof Error ? err.message : 'Please try again'));
    }finally{setAuthLoading(false);}
  };

  const requestPasswordReset=async()=>{
    const email = authEmail.trim();
    if(!email){alert('Enter your email address');return;}
    if(!_isValidEmail(email)){alert('Please enter a valid email address');return;}
    setAuthLoading(true);
    try{
      const r=await fetch(`${apiBase}/auth/request-password-reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      if(!r.ok){const msg=await _getApiError(r);throw new Error(msg);}
      setAuthView('reset-verify');
    }catch(err){alert('Failed: '+(err instanceof Error ? err.message : 'Please try again'));}
    finally{setAuthLoading(false);}
  };

  const verifyPasswordReset=async()=>{
    if(!authEmail||!authOtp||!authNewPassword){alert('Fill all fields');return;}
    if(authNewPassword.length < 6){alert('Password must be at least 6 characters');return;}
    setAuthLoading(true);
    try{
      const r=await fetch(`${apiBase}/auth/verify-password-reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:authEmail.trim(),code:authOtp,new_password:authNewPassword})});
      if(!r.ok){const msg=await _getApiError(r);throw new Error(msg);}
      setAuthPassword(authNewPassword);await loginUser();
    }catch(err){alert('Reset failed: '+(err instanceof Error ? err.message : 'Please try again'));}
    finally{setAuthLoading(false);}
  };
  const handleLogout=()=>{try{['gharka_token','gharka_user_email','gharka_user_name','gharka_user_type'].forEach(k=>localStorage.removeItem(k));}catch{}setUserName(null);setUserEmailDisplay(null);setUserType(null);setProfileMenuOpen(false);setChatId(null);setMessages([]);setStreamReady(false);seqMapRef.current={};};

  const showChefSlug = authUserType === 'Chef' || authUserType === 'Restaurant/Foodcourt';
  const normalizeSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  useEffect(() => {
    if (!showChefSlug) { setChefSlugStatus('idle'); return; }
    const slug = normalizeSlug(authChefSlug);
    if (!slug) { setChefSlugStatus('idle'); return; }
    if (slug.length < 3) { setChefSlugStatus('invalid'); return; }
    const reserved = new Set(['admin','chef','chef-dashboard','find-chef','login','register','api','www']);
    if (reserved.has(slug)) { setChefSlugStatus('taken'); return; }
    setChefSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/chefs/${encodeURIComponent(slug)}`);
        if (res.ok) setChefSlugStatus('taken');
        else if (res.status === 404) setChefSlugStatus('available');
        else setChefSlugStatus('error');
      } catch {
        setChefSlugStatus('error');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [authChefSlug, showChefSlug, apiBase]);

  const isHomePage = !pathname || pathname==='/' || pathname.startsWith('/instructions');

  /* helper to build hoverable menu item */
  const MenuItem=({label,onClick,danger}:{label:string;onClick:()=>void;danger?:boolean})=>(
    <button onClick={onClick} style={{width:'100%',textAlign:'left',padding:'10px 16px',fontSize:13,color:danger?'var(--error)':'var(--text-secondary)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',transition:'background 0.15s',display:'block'}}
      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=danger?'rgba(224,107,107,0.08)':'var(--accent-alpha-10)'}
      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='none'}>
      {label}
    </button>
  );

  return (
    <div style={{ display:'flex', height:'100dvh', overflow:'hidden', background:'var(--bg)', color:'var(--text-primary)', fontFamily:"'DM Sans',system-ui,sans-serif", transition:'background 0.3s,color 0.3s' }}>

      {mobileDrawerOpen && <div onClick={()=>setMobileDrawerOpen(false)} style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)' }}/>}

      {/* ══════ SIDEBAR ══════ */}
      <aside id="gk-sidebar" style={{ width:drawerOpen?264:60, flexShrink:0, background:'var(--bg-elevated)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', transition:'width 0.28s cubic-bezier(.4,0,.2,1),background 0.3s', overflow:'hidden' }}>
        {/* Brand + sidebar toggle (Claude-style: toggle lives inside sidebar) */}
        <div style={{ padding:'12px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, justifyContent:'space-between', flexShrink:0 }}>
          <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
            <img src="/logo.png" alt="" style={{ width:32, height:32, borderRadius:8, objectFit:'contain', flexShrink:0 }}/>
            {drawerOpen && <div style={{minWidth:0}}><h1 style={{fontSize:14,fontWeight:800,color:'var(--text-primary)',margin:0,lineHeight:1.2,letterSpacing:'-0.01em'}}>Chefsy</h1><p style={{fontSize:10,color:'var(--accent)',margin:0,letterSpacing:'0.06em',textTransform:'uppercase',fontWeight:600}}>AI Kitchen</p></div>}
          </div>
          {/* Toggle button — always visible inside sidebar, Claude-style */}
          <button onClick={()=>{setDrawerOpen(s=>!s);}} title="Toggle sidebar"
            style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:6,border:'none',background:'transparent',color:'var(--text-tertiary)',cursor:'pointer',flexShrink:0,transition:'color 0.15s,background 0.15s'}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-alpha-10)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-tertiary)';}}>
            {drawerOpen
              ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18" strokeLinecap="round"/><path d="M15 9l-3 3 3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18" strokeLinecap="round"/><path d="M13 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        </div>
        {/* Nav items */}
        <div style={{ padding:drawerOpen?'10px 10px 4px':'10px 6px 4px', flexShrink:0, display:'flex', flexDirection:'column', gap:2 }}>
          {/* New Chat */}
          <button onClick={async()=>{try{await createChatSession();}catch{}setChatId(null);setMessages([]);setMobileDrawerOpen(false);}}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:drawerOpen?'flex-start':'center', gap:8, padding:drawerOpen?'9px 12px':'9px', borderRadius:10, border:'none', background:'var(--accent-alpha-10)', color:'var(--accent)', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', marginBottom:2 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            {drawerOpen && 'New Chat'}
          </button>
          {/* AI Recipes */}
          <a href="/recipes" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:drawerOpen?'flex-start':'center', gap:8, padding:drawerOpen?'8px 12px':'8px', borderRadius:10, textDecoration:'none', color:'var(--text-secondary)', fontSize:13, fontWeight:500, fontFamily:'inherit', transition:'background 0.15s,color 0.15s' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-alpha-10)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
            <span style={{fontSize:15,flexShrink:0}}>🍳</span>
            {drawerOpen && <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>AI Recipes</span>}
          </a>
          {/* Find a Chef */}
          <a href="/find-chef" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:drawerOpen?'flex-start':'center', gap:8, padding:drawerOpen?'8px 12px':'8px', borderRadius:10, textDecoration:'none', color:'var(--text-secondary)', fontSize:13, fontWeight:500, fontFamily:'inherit', transition:'background 0.15s,color 0.15s' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-alpha-10)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
            <span style={{fontSize:15,flexShrink:0}}>👨‍🍳</span>
            {drawerOpen && <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Find a Chef</span>}
          </a>
          {/* Meal Planner */}
          <a href="/meal-plans" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:drawerOpen?'flex-start':'center', gap:8, padding:drawerOpen?'8px 12px':'8px', borderRadius:10, textDecoration:'none', color:'var(--text-secondary)', fontSize:13, fontWeight:500, fontFamily:'inherit', transition:'background 0.15s,color 0.15s' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-alpha-10)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
            <span style={{fontSize:15,flexShrink:0}}>🗓️</span>
            {drawerOpen && <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Meal Planner</span>}
          </a>
          {/* Chef-only section — Manage Profile & Manage Recipes */}
          {userName && (userType === 'Chef' || userType === 'Restaurant/Foodcourt') && (<>
            <div style={{height:1,background:'var(--border)',margin:'4px 4px'}}/>
            {drawerOpen && <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--accent)',paddingLeft:12,paddingTop:6,marginBottom:2,marginTop:2}}>Chef Panel</p>}
            <a href="/chef-dashboard/profile" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:drawerOpen?'flex-start':'center', gap:8, padding:drawerOpen?'8px 12px':'8px', borderRadius:10, textDecoration:'none', color:'var(--text-secondary)', fontSize:13, fontWeight:500, fontFamily:'inherit', transition:'background 0.15s,color 0.15s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-alpha-10)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
              <span style={{fontSize:15,flexShrink:0}}>👤</span>
              {drawerOpen && <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Manage Profile</span>}
            </a>
            <a href="/chef-dashboard/recipes" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:drawerOpen?'flex-start':'center', gap:8, padding:drawerOpen?'8px 12px':'8px', borderRadius:10, textDecoration:'none', color:'var(--text-secondary)', fontSize:13, fontWeight:500, fontFamily:'inherit', transition:'background 0.15s,color 0.15s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-alpha-10)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
              <span style={{fontSize:15,flexShrink:0}}>🍳</span>
              {drawerOpen && <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Manage Recipes</span>}
            </a>
          </>)}
          {/* Divider */}
          <div style={{height:1,background:'var(--border)',margin:'4px 4px'}}/>
        </div>
        {/* Chat list */}
        <div style={{ flex:1, overflowY:'auto', padding:drawerOpen?'4px 8px':'4px 6px', minHeight:0 }}>
          {drawerOpen && <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-tertiary)', paddingLeft:8, paddingTop:4, marginBottom:8 }}>Recent chats</p>}
          {recentChats.slice(0,25).map(c => (
            <button key={c.chat_id} onClick={()=>loadChat(c.chat_id)} title={c.title} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, border:'none', background:'transparent', cursor:'pointer', textAlign:'left', marginBottom:2, color:'var(--text-secondary)', fontSize:13.5, fontFamily:'inherit', transition:'background 0.15s,color 0.15s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-alpha-10)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0,opacity:0.5}}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              {drawerOpen && <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c.title}</span>}
            </button>
          ))}
        </div>
        {/* Footer */}
        <div style={{ flexShrink:0, padding:drawerOpen?'12px':'12px 8px', borderTop:'1px solid var(--border)' }}>
          <button onClick={()=>router.push('/upgrade')} style={{ width:'100%', padding:drawerOpen?'10px 16px':'10px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--claude-orange),#C45E3A)', color:'#fff', fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:'inherit', cursor:'pointer', marginBottom:10 }}>
            {drawerOpen?'✦ Upgrade to Pro':'✦'}
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px', borderRadius:10, justifyContent:drawerOpen?'flex-start':'center' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,var(--claude-orange),#C45E3A)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700, flexShrink:0 }}>
              {(userName||'G').charAt(0).toUpperCase()}
            </div>
            {drawerOpen && <div style={{minWidth:0}}><p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{userName??'Guest'}</p>{userEmailDisplay&&<p style={{fontSize:11,color:'var(--text-tertiary)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{userEmailDisplay}</p>}</div>}
          </div>
        </div>
      </aside>

      {/* ══════ MAIN ══════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

        {/* Header */}
        <header style={{ flexShrink:0, height:58, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)', gap:10, transition:'background 0.3s' }}>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            {/* Mobile-only hamburger */}
            <button onClick={()=>setMobileDrawerOpen(s=>!s)} style={{width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,border:'none',background:'transparent',color:'var(--text-secondary)',cursor:'pointer'}} id="mobile-menu-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
          <span style={{fontSize:15,fontWeight:700,color:'var(--text-primary)',letterSpacing:'-0.01em',flex:1,textAlign:'center'}}>Chefsy</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {/* ← Theme toggle always visible */}
            <ThemeToggle/>
            {!userName&&!userEmailDisplay?(
              <button onClick={()=>{setAuthView('login');setShowAuth(true);}} style={{padding:'7px 18px',borderRadius:999,border:'none',background:'linear-gradient(135deg,var(--claude-orange),#C45E3A)',color:'#fff',fontSize:13,fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>Login</button>
            ):(
              <div style={{position:'relative'}}>
                <button onClick={()=>setProfileMenuOpen(o=>!o)} style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,var(--claude-orange),#C45E3A)',border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {(userName||userEmailDisplay||'U').trim().charAt(0).toUpperCase()}
                </button>
                {profileMenuOpen&&(
                  <div style={{position:'absolute',right:0,top:44,width:200,borderRadius:12,background:'var(--bg-surface)',border:'1px solid var(--border)',boxShadow:'var(--shadow-lg)',zIndex:60,overflow:'hidden'}}>
                    <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}><p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',margin:0}}>{userName??'User'}</p><p style={{fontSize:11,color:'var(--text-tertiary)',margin:'2px 0 0'}}>{userEmailDisplay??''}</p></div>
                    <MenuItem label="Profile" onClick={()=>{setProfileMenuOpen(false);router.push('/profile');}}/>
                    <MenuItem label="Upgrade"  onClick={()=>{setProfileMenuOpen(false);router.push('/profile#upgrade');}}/>
                    <div style={{borderTop:'1px solid var(--border)'}}><MenuItem label="Logout" onClick={handleLogout} danger/></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Chat area */}
        <div ref={scrollRef} style={{ flex:1, overflowY:'auto', overflowX:'hidden', minHeight:0, background:'var(--bg)' }}>
          <div style={{ maxWidth:680, margin:'0 auto', padding:'24px 16px 16px', width:'100%' }}>

            {/* Home state */}
            {messages.length===0 && isHomePage && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',paddingTop:24}}>
                <div style={{position:'relative',marginBottom:24}}>
                  <div style={{position:'absolute',inset:'-40%',background:'var(--accent-alpha-15)',borderRadius:'50%',filter:'blur(40px)'}}/>
                  <img src="/logo.png" alt="Chefsy" style={{position:'relative',width:96,height:96,objectFit:'contain',filter:'drop-shadow(0 4px 16px rgba(0,0,0,0.15))'}}/>
                </div>
                <h1 style={{fontSize:28,fontWeight:800,color:'var(--text-primary)',margin:'0 0 8px',letterSpacing:'-0.02em'}}>Welcome to Chefsy 🍳</h1>
                <p style={{fontSize:15,color:'var(--text-secondary)',maxWidth:380,lineHeight:1.7,margin:'0 0 28px'}}>Your AI-powered kitchen companion for recipes, ingredients, and nutrition insights.</p>
                {uniqueRecent.length>0&&(
                  <div style={{width:'100%',maxWidth:640,textAlign:'left'}}>
                    <p style={{fontSize:11,fontWeight:600,color:'var(--text-tertiary)',marginBottom:10}}>🔥 Popular &nbsp;·&nbsp; tap for instant results</p>
                    <div className='gk-popular-grid' style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
                      {uniqueRecent.map(r=>(
                        <button key={r.recipe_key} onClick={()=>{setMessage(r.title);sendMessage(r.title,'Text',selectedProvider??undefined);}}
                          style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',cursor:'pointer',border:'1px solid var(--border)',borderRadius:14,background:'var(--bg-surface)',textAlign:'left',fontFamily:'inherit',transition:'border-color 0.18s,box-shadow 0.18s'}}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent-alpha-30)';(e.currentTarget as HTMLElement).style.boxShadow='var(--glow-accent)';}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.boxShadow='none';}}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:14,fontWeight:600,color:'var(--text-primary)',margin:'0 0 6px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</p>
                            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                              {r.cuisine&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:'var(--bg-elevated)',color:'var(--text-secondary)',border:'1px solid var(--border)'}}>{r.cuisine}</span>}
                              {r.difficulty&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:'var(--bg-elevated)',color:'var(--text-secondary)',border:'1px solid var(--border)'}}>{r.difficulty}</span>}
                              {r.estimated_time&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:'var(--bg-elevated)',color:'var(--text-secondary)',border:'1px solid var(--border)'}}>⏱ {r.estimated_time}</span>}
                            </div>
                          </div>
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0,color:'var(--text-tertiary)',marginTop:3}}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {uniqueRecent.length===0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
                    {['Chicken Biryani','South Indian breakfast','High protein meals','Quick 15-min dinner'].map(s=>(
                      <button key={s} onClick={()=>setMessage(s)} style={{padding:'8px 16px',borderRadius:999,fontSize:13,color:'var(--text-secondary)',background:'var(--bg-surface)',border:'1px solid var(--border)',fontFamily:'inherit',cursor:'pointer',transition:'border-color 0.15s,color 0.15s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent-alpha-30)';(e.currentTarget as HTMLElement).style.color='var(--accent)';}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.length>0&&(
              <div style={{display:'flex',flexDirection:'column'}}>
                {messages.map((msg,idx)=>{
                  const isLast=idx===messages.length-1;

                  /* ── User bubble ── */
                  if(msg.role==='user') return(
                    <div key={idx} style={{display:'flex',justifyContent:'flex-end',padding:'16px 0 8px'}}>
                      <div style={{
                        background:'var(--accent-alpha-15)',
                        border:'1px solid var(--accent-alpha-30)',
                        borderRadius:18,borderTopRightRadius:4,
                        padding:'10px 16px',maxWidth:'min(80%,420px)',
                        color:'var(--text-primary)',fontSize:14,lineHeight:1.65,
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  );

                  /* ── Assistant response ── */
                  return(
                    <div key={idx}>
                      <div style={{paddingTop:4,paddingBottom:4}}>
                        {msg.isLoading?<ChefLoadingCard/>
                        :isSaving&&msg.blocks&&!msg.blocks.some((b:any)=>b.block_type==='recipe')?(
                          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0'}}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{color:'var(--accent)',animation:'gkSpin 1s linear infinite',flexShrink:0}}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"/></svg>
                            <p style={{fontSize:13,color:'var(--text-tertiary)',margin:0}}>Saving to database…</p>
                          </div>
                        ):msg.error?(
                          <p style={{fontSize:14,color:'var(--error)',margin:'6px 0'}}>⚠️ {msg.error}</p>
                        ):msg.blocks&&msg.blocks.length>0?(
                          /* Render each block with a clear divider between them */
                          <div>
                            {msg.blocks.map((block:any,bidx:number)=>{
                              const isLastBlock=bidx===msg.blocks!.length-1;
                              let node:React.ReactNode=null;

                              if(block.block_type==='text'){
                                const raw=(block.content_json?.text as string)||'';
                                // While streaming, show partial JSON fragments to keep user engaged.
                                if(!raw||(!isStreaming && !isSaving && raw.trimStart().startsWith('{'))) return null;
                                if(isStreaming||isSaving){
                                  const readable=raw.replace(/[{}\[\]"]/g,' ').replace(/,\s*/g,'\n').replace(/\s{2,}/g,' ').trim();
                                  node=(
                                    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                                      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8}}>
                                        <span>👨‍🍳</span>
                                        <p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',margin:0,flex:1}}>AI Chef is cooking…</p>
                                        <span style={{width:5,height:12,background:'var(--accent)',borderRadius:2,animation:'gkPulse 1s ease-in-out infinite',flexShrink:0}}/>
                                      </div>
                                      <div style={{padding:'10px 14px'}}><p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap',fontFamily:'monospace',margin:0}}>{readable}</p></div>
                                    </div>
                                  );
                                } else {
                                  node=<p style={{fontSize:14,color:'var(--text-secondary)',lineHeight:1.75,margin:0}}>{raw}</p>;
                                }
                              } else if(block.block_type==='recipe'){
                                const rd=(msg.recipe&&Object.keys(msg.recipe).length>0)?msg.recipe:block.content_json;
                                node=rd&&(rd as any).title
                                  ?<RecipeJsonCard recipe={rd as Record<string,any>}/>
                                  :<ChatBlockRenderer block={block} recipe={msg.recipe??undefined}/>;
                              } else if(block.block_type==='cta'){
                                // CTAs (Find Chef / Restaurant / Watch Video) live inside RecipeMarkdown
                                return null;
                              } else {
                                node=<ChatBlockRenderer block={block} recipe={msg.recipe??undefined}/>;
                              }

                              if(!node) return null;

                              return(
                                <div key={bidx}>
                                  {/* Content */}
                                  <div style={{paddingTop:12,paddingBottom:12}}>{node}</div>

                                  {/* ── Divider between blocks ── */}
                                  {!isLastBlock&&(
                                    <div style={{display:'flex',alignItems:'center',gap:10,margin:'6px 0'}}>
                                      <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                                      <span style={{fontSize:10,color:'var(--text-tertiary)',letterSpacing:'0.12em',fontWeight:500,opacity:0.6,userSelect:'none' as const}}>
                                        {block.block_type==='ad'?'sponsored':'· · ·'}
                                      </span>
                                      <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ):msg.recipe&&(msg.recipe as any).title?(
                          <div style={{paddingTop:8,paddingBottom:8}}>
                            <RecipeJsonCard recipe={msg.recipe as Record<string,any>}/>
                          </div>
                        ):null}
                      </div>

                      {/* ── Divider before next user message ── */}
                      {!isLast&&messages[idx+1]?.role==='user'&&(
                        <div style={{display:'flex',alignItems:'center',gap:10,margin:'14px 0 6px'}}>
                          <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                          <span style={{fontSize:12,color:'var(--text-tertiary)',opacity:0.5}}>✦</span>
                          <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Videos — clear section divider */}
            {videos.length>0&&(
              <div style={{marginTop:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10,margin:'16px 0'}}>
                  <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                  <span style={{fontSize:11,color:'var(--text-tertiary)',letterSpacing:'0.1em',textTransform:'uppercase',flexShrink:0}}>🎬 Videos</span>
                  <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                </div>
                <div className='gk-video-grid' style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                  {videos.map((v:any,i:number)=>{
                    const wu=v.watchUrl||v.url||'';const vid=wu.match(/[?&]v=([^&]+)/)?.[1]||wu.split('/').pop()||'';const pl=playingUrl===wu;
                    return(
                      <div key={i} style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
                        {pl?(
                          <div style={{position:'relative',paddingTop:'56.25%'}}>
                            <iframe src={`https://www.youtube.com/embed/${vid}?autoplay=1`} title={v.title||'Video'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}}/>
                            <button onClick={()=>setPlayingUrl(null)} style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.65)',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12}}>✕</button>
                          </div>
                        ):(
                          <>{v.thumbnail&&(<button onClick={()=>setPlayingUrl(wu)} style={{display:'block',width:'100%',padding:0,border:'none',background:'none',cursor:'pointer',position:'relative'}}><img src={v.thumbnail} alt={v.title} style={{width:'100%',aspectRatio:'16/9',objectFit:'cover',display:'block'}}/><div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.3)'}}><div style={{width:48,height:48,borderRadius:'50%',background:'#dc2626',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></button>)}
                          <div style={{padding:'10px 14px'}}><p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{v.title}</p>{v.channel&&<p style={{fontSize:11,color:'var(--text-tertiary)',margin:'4px 0 0'}}>{v.channel}</p>}</div></>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

   
        {/* Input bar — flush with chat bg, no double-box */}
        <div style={{flexShrink:0,padding:'10px 16px 14px',background:'var(--bg)',borderTop:'1px solid var(--border)',transition:'background 0.3s'}}>
          <div style={{maxWidth:680,margin:'0 auto'}}>
            <SearchBar value={message} onChange={setMessage} onSubmit={sendMessage} loading={loading} providers={providers} selectedProvider={selectedProvider} onProviderChange={setSelectedProvider}/>
        <p style={{textAlign:'center',fontSize:11,color:'var(--text-disabled)',marginTop:6}}>Chefsy can make mistakes. Always verify food safety information.</p>
          </div>
        </div>
      </div>

      {/* ══════ AUTH MODAL ══════ */}
      {showAuth&&(
        <div style={{position:'fixed',inset:0,zIndex:70,display:'flex'}}>
          <div id="auth-img" style={{display:'none',width:'50%',position:'relative',overflow:'hidden',background:'var(--bg)'}}>
            <img src="/chef-cooking.png" alt="" style={{objectFit:'cover',width:'100%',height:'100%',opacity:0.75}} onError={e=>{(e.currentTarget as HTMLImageElement).src='/logo.png';}}/>
            <div style={{position:'absolute',inset:0,background:'linear-gradient(to right,transparent,rgba(0,0,0,0.3))'}}/>
            <div style={{position:'absolute',bottom:40,left:36}}><h2 style={{fontSize:30,fontWeight:800,color:'#fff',margin:0}}>Cook with confidence.</h2><p style={{color:'rgba(255,255,255,0.65)',marginTop:6}}>AI-powered recipes for every kitchen.</p></div>
          </div>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',background:'var(--bg-elevated)',overflowY:'auto'}}>
            <div style={{width:'100%',maxWidth:360}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:28}}>
                <div>
                  <h2 style={{fontSize:24,fontWeight:800,color:'var(--text-primary)',margin:0,letterSpacing:'-0.02em'}}>{authView==='login'?'Welcome back':authView==='register'?'Create account':authView==='reset'?'Reset password':'Verify code'}</h2>
                  <p style={{fontSize:14,color:'var(--text-secondary)',margin:'6px 0 0'}}>{authView==='login'?'Sign in to your Chefsy account':authView==='register'?'Join Chefsy today':'Enter the details below'}</p>
                </div>
                <button onClick={()=>setShowAuth(false)} style={{width:34,height:34,borderRadius:8,border:'none',background:'var(--bg-elevated)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {authView==='login'&&<><input className="gk-input" placeholder="Email address" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)}/><input className="gk-input" placeholder="Password" type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loginUser()}/><div style={{textAlign:'right'}}><button onClick={()=>setAuthView('reset')} style={{fontSize:12,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>Forgot password?</button></div><button className="gk-btn-primary" onClick={loginUser} disabled={authLoading||!authEmail||!authPassword} style={{width:'100%',padding:'12px'}}>{authLoading?'Signing in…':'Sign in'}</button></>}
                {authView==='register'&&<>
                  <input className="gk-input" placeholder="Full name" value={authFullName} onChange={e=>setAuthFullName(e.target.value)}/>
                  <input className="gk-input" placeholder="Email address" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)}/>
                  <input className="gk-input" placeholder="Password" type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)}/>
                  <input className="gk-input" placeholder="Phone (optional)" value={authPhone} onChange={e=>setAuthPhone(e.target.value)}/>
                  <select className="gk-input" value={authUserType} onChange={e=>setAuthUserType(e.target.value)}>
                    <option value="">Select role</option>
                    {['Chef','Restaurant/Foodcourt','Working Professional','House Wife','Freelance','Student','Business','Other'].map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                  {showChefSlug && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        className="gk-input"
                        placeholder="Profile name (e.g., srikanth)"
                        value={authChefSlug}
                        onChange={e=>setAuthChefSlug(e.target.value)}
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        URL: {normalizeSlug(authChefSlug || 'yourname')}.chefsy.com
                      </div>
                      <div style={{ fontSize: 11, color: chefSlugStatus==='available' ? 'var(--success)' : chefSlugStatus==='taken' || chefSlugStatus==='invalid' ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                        {chefSlugStatus==='checking' && 'Checking availability…'}
                        {chefSlugStatus==='available' && 'Available'}
                        {chefSlugStatus==='taken' && 'Already taken'}
                        {chefSlugStatus==='invalid' && 'Please use at least 3 characters (letters/numbers)'}
                        {chefSlugStatus==='error' && 'Unable to check now'}
                        {chefSlugStatus==='idle' && ''}
                      </div>
                    </div>
                  )}
                  {authError && <p style={{margin:0,padding:'10px 12px',background:'var(--danger-alpha-10,rgba(239,68,68,0.1))',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,fontSize:13,color:'#ef4444',lineHeight:1.5}}>{authError}</p>}
                  <button className="gk-btn-primary" onClick={registerUser} disabled={authLoading||!authFullName||!authEmail||!authPassword} style={{width:'100%',padding:'12px'}}>{authLoading?'Creating account…':'Create account'}</button>
                </>}
                {authView==='reset'&&<><input className="gk-input" placeholder="Email address" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)}/><button className="gk-btn-primary" onClick={requestPasswordReset} disabled={authLoading||!authEmail} style={{width:'100%',padding:'12px'}}>{authLoading?'Sending…':'Send reset code'}</button></>}
                {authView==='reset-verify'&&<><input className="gk-input" placeholder="Reset code" value={authOtp} onChange={e=>setAuthOtp(e.target.value)}/><input className="gk-input" placeholder="New password" type="password" value={authNewPassword} onChange={e=>setAuthNewPassword(e.target.value)}/><button className="gk-btn-primary" onClick={verifyPasswordReset} disabled={authLoading||!authOtp||!authNewPassword} style={{width:'100%',padding:'12px'}}>{authLoading?'Saving…':'Set new password'}</button></>}
              </div>
              <p style={{textAlign:'center',fontSize:13,color:'var(--text-tertiary)',marginTop:24}}>
                {authView!=='register'?(<>New here? <button onClick={()=>{setAuthView('register');setAuthError('');}} style={{color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:500}}>Create an account</button></>):(<>Already have an account? <button onClick={()=>{setAuthView('login');setAuthError('');}} style={{color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:500}}>Sign in</button></>)}
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes gkSpin   { to { transform:rotate(360deg); } }
        @keyframes gkPulse  { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes gkBounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-5px);} }

        /* Desktop sidebar: relative not fixed */
        @media(min-width:1025px){
          #gk-sidebar{ position:relative!important; transform:translateX(0)!important; }
          #mobile-menu-btn{ display:none!important; }
        }
        @media(max-width:1024px){
          #gk-sidebar{ position:fixed!important; top:0; bottom:0; left:0; z-index:50; transform:${mobileDrawerOpen?'translateX(0)':'translateX(-100%)'}; transition:transform 0.28s cubic-bezier(.4,0,.2,1)!important; }
          #sidebar-toggle{ display:none!important; }
        }
        @media(min-width:640px){ .theme-label{display:inline!important;} }
        @media(min-width:768px){ #auth-img{display:block!important;} }
      `}</style>
    </div>
  );
}
