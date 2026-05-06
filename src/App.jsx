import { useEffect, useMemo, useState } from "react";
import { supabase } from "./services/supabase";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [view, setView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ---------------- AUTH ----------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  // ---------------- DATA ----------------
  useEffect(() => {
    if (!session) return;

    const load = async () => {
      setLoading(true);

      const [{ data: staffData }, { data: attData }, { data: policyData }] =
        await Promise.all([
          supabase.from("staff").select("*"),
          supabase.from("attendance").select("*"),
          supabase.from("policy").select("*").single(),
        ]);

      setStaff(staffData || []);
      setAttendance(attData || []);
      setPolicy(policyData || {});
      setLoading(false);
    };

    load();

    // ---------------- REALTIME ----------------
    const channel = supabase
      .channel("enterprise-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        (payload) => {
          setAttendance((prev) => {
            let data = [...prev];

            if (payload.eventType === "INSERT") data.push(payload.new);

            if (payload.eventType === "UPDATE") {
              const i = data.findIndex((x) => x.id === payload.new.id);
              if (i !== -1) data[i] = payload.new;
            }

            if (payload.eventType === "DELETE") {
              data = data.filter((x) => x.id !== payload.old.id);
            }

            return data;
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session]);

  if (!session) return <Login setSession={setSession} />;
  if (loading) return <Skeleton />;

  const stats = {
    staff: staff.length,
    attendance: attendance.length,
    active: attendance.filter((a) => a.status === "present").length,
  };

  return (
    <div className="enterprise-layout">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="brand">ARMBURU</div>

        <button onClick={() => setView("dashboard")}>Dashboard</button>
        <button onClick={() => setView("staff")}>Staff</button>
        <button onClick={() => setView("attendance")}>Attendance</button>
        <button onClick={() => setView("policy")}>Policy</button>

        <button
          className="toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? "Collapse" : "Expand"}
        </button>

        <button className="logout" onClick={() => supabase.auth.signOut()}>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* HEADER */}
        <div className="topbar">
          <h1>{view.toUpperCase()}</h1>
          <span className="live">● LIVE</span>
        </div>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div className="grid">
            <Card title="Total Staff" value={stats.staff} />
            <Card title="Attendance Records" value={stats.attendance} />
            <Card title="Active Today" value={stats.active} />
          </div>
        )}

        {/* STAFF */}
        {view === "staff" && (
          <Table
            data={staff}
            cols={["username", "role"]}
          />
        )}

        {/* ATTENDANCE */}
        {view === "attendance" && (
          <Table
            data={attendance}
            cols={["staff_id", "status"]}
          />
        )}

        {/* POLICY */}
        {view === "policy" && (
          <div className="panel">
            <pre>{JSON.stringify(policy, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Card({ title, value }) {
  return (
    <div className="card">
      <h4>{title}</h4>
      <p>{value}</p>
    </div>
  );
}

function Table({ data, cols }) {
  return (
    <div className="table">
      {data.map((row, i) => (
        <div key={i} className="row">
          {cols.map((c) => (
            <span key={c}>{row[c]}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return <div className="loading">Loading enterprise dashboard...</div>;
}

/* ---------------- LOGIN ---------------- */

function Login({ setSession }) {
  const [form, setForm] = useState({ email: "", password: "" });

  const login = async () => {
    const { data } = await supabase.auth.signInWithPassword(form);
    setSession(data.session);
  };

  return (
    <div className="login">
      <h2>Enterprise Login</h2>

      <input
        placeholder="email"
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <input
        type="password"
        placeholder="password"
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <button onClick={login}>Sign In</button>
    </div>
  );
}