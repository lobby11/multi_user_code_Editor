import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect, useCallback } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"

/* ── Add to index.html <head> ─────────────────────────────────────────────
   <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
   ──────────────────────────────────────────────────────────────────────── */

const CODER_COLORS = ["#FF4757","#FFA502","#2ED573","#1E90FF","#FF6B81","#ECCC68","#70A1FF","#FF6348"]

const S = {
  bolt:  { display:"inline-block", width:9, height:9, borderRadius:"50%", background:"#0d0d0d", border:"2px solid #FFD60A", flexShrink:0 },
  btn:   (bg, fg="#0d0d0d") => ({ background:bg, color:fg, border:"2.5px solid #0d0d0d", borderRadius:10, fontFamily:"'Fredoka One',cursive", fontSize:14, padding:"6px 16px", cursor:"pointer", boxShadow:"3px 3px 0 #0d0d0d", transition:"transform 0.08s, box-shadow 0.08s", userSelect:"none" }),
  panel: (bg="#1e2235")     => ({ background:bg, border:"2.5px solid #0d0d0d", borderRadius:14, overflow:"hidden" }),
  tag:   (bg, fg="#0d0d0d") => ({ background:bg, color:fg, border:"2px solid #0d0d0d", borderRadius:8, fontFamily:"'Fredoka One',cursive", fontSize:12, padding:"2px 10px" }),
  mono:  (color="#8892b0", size=11) => ({ fontFamily:"'Space Mono',monospace", fontSize:size, color }),
}

function makePersistentYDoc() {
  const doc = new Y.Doc()
  const KEY = "coders-cid"
  const stored = sessionStorage.getItem(KEY)
  if (stored) { doc.clientID = parseInt(stored, 10) }
  else        { sessionStorage.setItem(KEY, String(doc.clientID)) }
  return doc
}

function Avatar({ name, size=30 }) {
  const color = CODER_COLORS[[...name].reduce((a,c) => a + c.charCodeAt(0), 0) % CODER_COLORS.length]
  return (
    <div style={{ width:size, height:size, background:color, border:"2.5px solid #0d0d0d", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Fredoka One',cursive", fontSize:size*0.38, color:"#0d0d0d", flexShrink:0, boxShadow:"2px 2px 0 #0d0d0d" }}>
      {name.slice(0,2).toUpperCase()}
    </div>
  )
}

function RivetBar() {
  return (
    <div style={{ display:"flex", gap:7, padding:"5px 12px", background:"#FFD60A", borderBottom:"2.5px solid #0d0d0d" }}>
      {[0,1,2].map(i => <span key={i} style={S.bolt} />)}
    </div>
  )
}

function Divider() {
  return <div style={{ width:1, height:26, background:"#0d0d0d", opacity:0.18, margin:"0 4px", flexShrink:0 }} />
}

export default function App() {

  const editorRef  = useRef(null)
  const bindingRef = useRef(null)

  const [username, setUsername] = useState(() =>
    localStorage.getItem("coders-user") ||
    new URLSearchParams(window.location.search).get("u") || ""
  )
  const [users,   setUsers]   = useState([])
  const [output,  setOutput]  = useState([])
  const [showOut, setShowOut] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [running, setRunning] = useState(false)

  const ydoc  = useMemo(() => makePersistentYDoc(), [])
  const ytext = useMemo(() => ydoc.getText("monaco"), [ydoc])

  const handleMount = useCallback((editor) => {
    editorRef.current = editor
    if (bindingRef.current) { bindingRef.current.destroy(); bindingRef.current = null }
    const model = editor.getModel()
    if (!model) return
    bindingRef.current = new MonacoBinding(ytext, model, new Set([editor]))
  }, [ytext])

  const handleJoin = (e) => {
    e.preventDefault()
    const val = e.target.u.value.trim()
    if (!val) return
    localStorage.setItem("coders-user", val)
    setUsername(val)
    window.history.replaceState({}, "", "?u=" + encodeURIComponent(val))
  }

  const runCode = () => {
    const code = editorRef.current?.getValue() || ""
    const logs = []
    const safe = {
      log:   (...a) => logs.push({ t:"log",   m: a.map(x => typeof x==="object" ? JSON.stringify(x,null,2) : String(x)).join(" ") }),
      error: (...a) => logs.push({ t:"error", m: a.map(String).join(" ") }),
      warn:  (...a) => logs.push({ t:"warn",  m: a.map(String).join(" ") }),
    }
    setRunning(true)
    setTimeout(() => {
      try { new Function("console", code)(safe) }
      catch (err) { logs.push({ t:"error", m: `${err.name}: ${err.message}` }) }
      setOutput(logs.length ? logs : [{ t:"log", m:"No output — add console.log() to see results here." }])
      setShowOut(true)
      setRunning(false)
    }, 280)
  }

  const shareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?u=${encodeURIComponent(username)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const outColor = { log:"#2ED573", error:"#FF4757", warn:"#FFA502" }

  useEffect(() => {
    if (!username) return
    const provider = new SocketIOProvider("http://localhost:3000", "monaco", ydoc, { autoConnect:true })
    provider.connect()
    provider.awareness.setLocalStateField("user", { username })
    const sync = () => {
      const all = Array.from(provider.awareness.getStates().values())
      setUsers(all.filter(s => s.user?.username).map(s => s.user))
    }
    sync()
    provider.awareness.on("change", sync)
    return () => {
      provider.awareness.setLocalState(null)
      provider.awareness.off("change", sync)
      provider.disconnect()
    }
  }, [username, ydoc])

  /* ── JOIN SCREEN ──────────────────────────────────────────────────────── */
  if (!username) return (

    <main style={{ background:"#0f1120", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Fredoka One',cursive" }}>

      {/* Subtle grid background */}
      <div style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(#1e2235 1px,transparent 1px),linear-gradient(90deg,#1e2235 1px,transparent 1px)", backgroundSize:"40px 40px", opacity:0.4, pointerEvents:"none" }} />

      <div style={{ ...S.panel("#1a1d30"), width:420, boxShadow:"8px 8px 0 #0d0d0d", position:"relative", zIndex:1 }}>

        <RivetBar />

        <div style={{ padding:"32px 32px 26px" }}>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
            <div style={{ width:54, height:54, background:"#FFD60A", border:"2.5px solid #0d0d0d", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, boxShadow:"3px 3px 0 #0d0d0d", flexShrink:0 }}>
              💻
            </div>
            <div>
              <div style={{ color:"#FFD60A", fontSize:30, letterSpacing:3, lineHeight:1 }}>CODERS</div>
              <div style={{ ...S.mono("#4a5280", 11), marginTop:3 }}>Real-time collaborative JavaScript editor</div>
            </div>
          </div>

          {/* Feature pills */}
          <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
            {["⚡ Live sync","👾 Multi-user","▶ Run JS","🔗 Instant share"].map(f => (
              <span key={f} style={{ ...S.mono("#8892b0", 10), background:"#0f1120", border:"1.5px solid #2a2d45", borderRadius:20, padding:"4px 10px" }}>{f}</span>
            ))}
          </div>

          {/* Tagline */}
          <p style={{ ...S.mono("#6b7499", 12), margin:"0 0 22px", lineHeight:1.8 }}>
            Write code together — no setup, no accounts, no friction.<br />
            Drop a link and your whole team is in the same editor instantly.
          </p>

          <form onSubmit={handleJoin} style={{ display:"flex", flexDirection:"column", gap:12 }}>

            <label style={{ ...S.mono("#FFD60A", 11), letterSpacing:1, marginBottom:2 }}>YOUR HANDLE</label>

            <div style={{ ...S.panel("#0f1120"), display:"flex", alignItems:"center", gap:10, padding:"12px 16px" }}>
              <span style={{ ...S.mono("#4a5280", 16) }}>›</span>
              <input
                name="u"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. alex_codes"
                defaultValue={new URLSearchParams(window.location.search).get("u") || ""}
                style={{ background:"transparent", border:"none", outline:"none", color:"#e8eaf6", fontFamily:"'Space Mono',monospace", fontSize:14, flex:1, caretColor:"#FFD60A" }}
              />
            </div>

            <button
              type="submit"
              style={{ ...S.btn("#FFD60A"), fontSize:17, padding:"13px", textAlign:"center", letterSpacing:1 }}
            >
              ⚡ Jump In
            </button>

          </form>

        </div>

        <div style={{ background:"#0f1120", borderTop:"2.5px solid #0d0d0d", padding:"12px 18px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:14 }}>🔗</span>
          <span style={{ ...S.mono("#4a5280", 11) }}>
            Got a link? Open it — you'll land directly in your friend's session.
          </span>
        </div>

      </div>

    </main>
  )

  /* ── EDITOR SCREEN ────────────────────────────────────────────────────── */
  return (

    <main style={{ background:"#0f1120", height:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Fredoka One',cursive", overflow:"hidden" }}>

      {/* TOP NAV */}
      <header style={{ background:"#FFD60A", borderBottom:"2.5px solid #0d0d0d", padding:"0 18px", display:"flex", alignItems:"center", gap:12, height:54, flexShrink:0 }}>

        <div style={{ width:34, height:34, background:"#0d0d0d", border:"2px solid #0d0d0d", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          💻
        </div>
        <span style={{ fontSize:20, color:"#0d0d0d", letterSpacing:3 }}>CODERS</span>

        <Divider />

        {/* JS badge — no language switcher, JS only */}
        <div style={{ ...S.tag("#0d0d0d","#FFD60A"), display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
          <span style={{ width:7, height:7, background:"#FFD60A", borderRadius:"50%" }} />
          JavaScript
        </div>

        <div style={{ flex:1 }} />

        {/* Live avatar cluster */}
        <div style={{ display:"flex", alignItems:"center" }}>
          {users.slice(0,6).map((u, i) => (
            <div key={i} title={`${u.username}${u.username===username?" (you)":""}`} style={{ marginLeft: i===0 ? 0 : -10, zIndex: 10-i }}>
              <Avatar name={u.username} size={30} />
            </div>
          ))}
        </div>

        <div style={{ ...S.tag("#0d0d0d","#FFD60A"), background:"#0d0d0d", marginLeft:8, fontSize:13 }}>
          {users.length} {users.length===1 ? "coder" : "coders"} live
        </div>

        <Divider />

        <button
          onClick={shareLink}
          style={{ ...S.btn(copied ? "#2ED573" : "#fff"), minWidth:130, fontSize:14 }}
        >
          {copied ? "✅ Link copied!" : "🔗 Invite teammates"}
        </button>

        <button
          onClick={runCode}
          style={{ ...S.btn("#FF4757","#fff"), minWidth:100, fontSize:14 }}
        >
          {running ? "⏳ Running…" : "▶ Run Code"}
        </button>

      </header>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* SIDEBAR */}
        <aside style={{ ...S.panel("#1a1d30"), width:216, borderRadius:0, borderTop:"none", borderLeft:"none", borderBottom:"none", display:"flex", flexDirection:"column", flexShrink:0 }}>

          <RivetBar />

          <div style={{ padding:"14px 14px 6px", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ ...S.mono("#FFD60A", 10), letterSpacing:1.5 }}>LIVE ROOM</span>
            <div style={{ flex:1 }} />
            <span style={{ width:7, height:7, background:"#2ED573", borderRadius:"50%", border:"1.5px solid #0d0d0d", animation:"pulse 2s infinite" }} />
          </div>

          {users.length === 0 && (
            <div style={{ padding:"10px 14px" }}>
              <p style={{ ...S.mono("#3a3f5c", 11), lineHeight:1.7, margin:0 }}>
                No one else here yet.<br/>Hit "Invite teammates" to share your session link.
              </p>
            </div>
          )}

          <ul style={{ flex:1, overflowY:"auto", padding:"6px 10px", display:"flex", flexDirection:"column", gap:6, margin:0, listStyle:"none" }}>
            {users.map((user, i) => (
              <li key={i} style={{ ...S.panel("#0f1120"), padding:"9px 11px", display:"flex", alignItems:"center", gap:9, borderRadius:10 }}>
                <Avatar name={user.username} size={28} />
                <div style={{ overflow:"hidden", flex:1 }}>
                  <div style={{ color:"#e8eaf6", fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {user.username}
                  </div>
                  {user.username === username && (
                    <div style={{ ...S.mono("#4a5280", 9), marginTop:1 }}>that's you</div>
                  )}
                </div>
                {user.username === username && (
                  <span style={{ ...S.tag("#FFD60A"), fontSize:10, flexShrink:0, padding:"1px 7px" }}>you</span>
                )}
              </li>
            ))}
          </ul>

          <div style={{ padding:"10px", borderTop:"2.5px solid #0d0d0d" }}>
            <p style={{ ...S.mono("#2e3252", 10), margin:"0 0 8px", letterSpacing:0.5 }}>
              SHARING SESSION AS
            </p>
            <div style={{ ...S.panel("#0f1120"), padding:"9px 11px", display:"flex", alignItems:"center", gap:8, borderRadius:10 }}>
              <span style={{ width:8, height:8, background:"#2ED573", borderRadius:"50%", border:"1.5px solid #0d0d0d", flexShrink:0 }} />
              <span style={{ ...S.mono("#aab0d4", 11), overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {username}
              </span>
            </div>
          </div>

        </aside>

        {/* EDITOR + OUTPUT COLUMN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* File tab bar */}
          <div style={{ background:"#1a1d30", borderBottom:"2.5px solid #0d0d0d", padding:"0 16px", display:"flex", alignItems:"center", gap:10, height:40, flexShrink:0 }}>
            <div style={{ ...S.tag("#FFD60A"), fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
              📄 main.js
            </div>
            <div style={{ flex:1 }} />
            {showOut && (
              <button
                onClick={() => setShowOut(false)}
                style={{ ...S.btn("#1a1d30","#6b7499"), padding:"2px 12px", fontSize:12, boxShadow:"2px 2px 0 #0d0d0d" }}
              >
                ✕ Hide Output
              </button>
            )}
          </div>

          {/* Monaco editor */}
          <div style={{ flex: showOut ? 0.58 : 1, overflow:"hidden", minHeight:0 }}>
            <Editor
              height="100%"
              path="main.js"
              language="javascript"
              defaultValue={"// ⚡ CODERS — write JavaScript here, hit Run to execute\n// Share the link above to code together in real time\n\nconsole.log('Hello, world!')\n"}
              theme="vs-dark"
              onMount={handleMount}
              options={{
                fontFamily: "'Space Mono','JetBrains Mono',monospace",
                fontSize: 14,
                lineHeight: 23,
                padding: { top:20, bottom:20 },
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
                minimap: { enabled:false },
                scrollbar: { verticalScrollbarSize:5, horizontalScrollbarSize:5 },
                renderLineHighlight: "gutter",
                bracketPairColorization: { enabled:true },
                guides: { bracketPairs:true, indentation:true },
              }}
            />
          </div>

          {/* OUTPUT PANEL */}
          {showOut && (
            <div style={{ flex:0.42, background:"#090b18", borderTop:"2.5px solid #FFD60A", display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>

              <div style={{ background:"#FFD60A", padding:"6px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                <span style={{ fontSize:13, color:"#0d0d0d" }}>▶ Output</span>
                <span style={{ ...S.mono("#0d0d0d",10), opacity:0.5 }}>JavaScript · in-browser execution</span>
                <div style={{ flex:1 }} />
                <button
                  onClick={() => setOutput([])}
                  style={{ ...S.btn("#0d0d0d","#FFD60A"), padding:"2px 12px", fontSize:12 }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowOut(false)}
                  style={{ ...S.btn("#0d0d0d","#FFD60A"), padding:"2px 10px", fontSize:12 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:5 }}>
                {output.map((line, i) => (
                  <div key={i} style={{ fontFamily:"'Space Mono',monospace", fontSize:12, color: outColor[line.t]||"#e8eaf6", display:"flex", gap:12, alignItems:"flex-start" }}>
                    <span style={{ color:"#2e3252", flexShrink:0, minWidth:24 }}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{ color: line.t==="error" ? "#FF4757" : line.t==="warn" ? "#FFA502" : "#3a4060" }}>&gt;</span>
                    <span style={{ whiteSpace:"pre-wrap", wordBreak:"break-all", flex:1 }}>{line.m}</span>
                  </div>
                ))}
                {output.length === 0 && (
                  <span style={{ ...S.mono("#2e3252",12) }}>
                    // Run your code — output will appear here
                  </span>
                )}
              </div>

            </div>
          )}

          {/* STATUS BAR */}
          <div style={{ background:"#090b18", borderTop:"2px solid #1a1d30", padding:"4px 18px", display:"flex", alignItems:"center", gap:20, flexShrink:0 }}>
            <span style={{ ...S.mono("#FFD60A",10), letterSpacing:1 }}>JAVASCRIPT</span>
            <span style={{ ...S.mono("#2e3252",10) }}>UTF-8</span>
            <span style={{ ...S.mono("#2e3252",10) }}>Spaces: 2</span>
            <div style={{ flex:1 }} />
            <span style={{ ...S.mono("#2ED573",10) }}>
              ● {users.length} {users.length===1?"coder":"coders"} editing live
            </span>
          </div>

        </div>

      </div>

    </main>
  )
}