
import { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDncnLN-Wz07A6QVK6vCXRQcDlYfvhchPg",
  authDomain: "fivedraft-2ff40.firebaseapp.com",
  projectId: "fivedraft-2ff40",
  storageBucket: "fivedraft-2ff40.firebasestorage.app",
  messagingSenderId: "200648604395",
  appId: "1:200648604395:web:1d70be159dda72926c5cae",
  measurementId: "G-XMBXC70KQ1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const criteria = [
  { key: "technique", label: "Technique" },
  { key: "finition", label: "Finition" },
  { key: "defense", label: "Défense" },
  { key: "physique", label: "Physique" },
  { key: "vitesse", label: "Vitesse" },
  { key: "collectif", label: "Collectif" },
];

function defaultRatings() {
  return Object.fromEntries(criteria.map((c) => [c.key, 3]));
}

function score(player) {
  const total = criteria.reduce((sum, c) => sum + Number(player[c.key] || 0), 0);
  if (player.status === "Blessé") return Math.round(total * 0.45);
  if (player.status === "Incertain") return Math.round(total * 0.75);
  return total;
}

function balanceTeams(players, teamCount = 2) {
  const available = players
    .filter((p) => p.status !== "Blessé")
    .sort((a, b) => score(b) - score(a));

  const teams = Array.from({ length: teamCount }, (_, i) => ({
    name: `Équipe ${i + 1}`,
    players: [],
    total: 0,
  }));

  for (const player of available) {
    teams.sort((a, b) => a.total - b.total || a.players.length - b.players.length);
    teams[0].players.push(player);
    teams[0].total += score(player);
  }

  return teams;
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("OK");
  const [ratings, setRatings] = useState(defaultRatings());
  const [teamCount, setTeamCount] = useState(2);
  const [showTeams, setShowTeams] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "players"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPlayers(data.sort((a, b) => score(b) - score(a)));
    });

    return () => unsubscribe();
  }, []);

  const teams = useMemo(() => balanceTeams(players, teamCount), [players, teamCount]);
  const injured = players.filter((p) => p.status === "Blessé");

  async function submitPlayer(e) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    await addDoc(collection(db, "players"), {
      name: cleanName,
      status,
      ...ratings,
      createdAt: serverTimestamp(),
    });

    setName("");
    setStatus("OK");
    setRatings(defaultRatings());
  }

  async function updateStatus(player, nextStatus) {
    await updateDoc(doc(db, "players", player.id), { status: nextStatus });
  }

  async function removePlayer(player) {
    await deleteDoc(doc(db, "players", player.id));
  }

  return (
    <div className="app">
      <main className="wrap">
        <section className="card">
          <p className="brand">⚽ FiveDraft</p>
          <h1>Auto-évaluation Five</h1>
          <p className="muted">Note-toi honnêtement de 1 à 5 pour générer des équipes équilibrées.</p>

          <form onSubmit={submitPlayer} className="form">
            <div>
              <label>Prénom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Alan" />
            </div>

            <div>
              <label>Statut</label>
              <div className="status-grid">
                {["OK", "Incertain", "Blessé"].map((s) => (
                  <button type="button" key={s} onClick={() => setStatus(s)} className={`status ${status === s ? "active" : ""}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {criteria.map((c) => (
              <div key={c.key} className="rating">
                <div className="rating-top">
                  <label>{c.label}</label>
                  <span className="value">{ratings[c.key]}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={ratings[c.key]}
                  onChange={(e) => setRatings({ ...ratings, [c.key]: Number(e.target.value) })}
                />
                <div className="scale"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
              </div>
            ))}

            <button className="primary">Envoyer ma note</button>
          </form>
        </section>

        <section>
          <div className="card">
            <div className="topbar">
              <div>
                <h2>Classement live</h2>
                <p className="muted">{players.length} joueur(s) inscrit(s)</p>
              </div>
              <div className="controls">
                <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>
                  <option value={2}>2 équipes</option>
                  <option value={3}>3 équipes</option>
                  <option value={4}>4 équipes</option>
                </select>
                <button onClick={() => setShowTeams(!showTeams)} className="white-btn">
                  {showTeams ? "Masquer" : "Créer équipes"}
                </button>
              </div>
            </div>

            {players.length === 0 && <p className="muted">Aucun joueur pour l’instant.</p>}

            {players.map((p, index) => (
              <div key={p.id} className="player">
                <div>
                  <div className="player-name">#{index + 1} {p.name} <span className="small">{p.status}</span></div>
                  <div className="small">
                    Tech {p.technique} · Fin {p.finition} · Déf {p.defense} · Phy {p.physique} · Vit {p.vitesse} · Col {p.collectif}
                  </div>
                </div>
                <div className="right">
                  <span className="score">{score(p)}</span>
                  <select value={p.status || "OK"} onChange={(e) => updateStatus(p, e.target.value)}>
                    <option>OK</option>
                    <option>Incertain</option>
                    <option>Blessé</option>
                  </select>
                  <button onClick={() => removePlayer(p)} className="delete">✕</button>
                </div>
              </div>
            ))}
          </div>

          {showTeams && (
            <div className="teams">
              {teams.map((team) => (
                <div key={team.name} className="card">
                  <h3>{team.name}</h3>
                  <p className="team-total">Total : {team.total}</p>
                  {team.players.map((p) => (
                    <div key={p.id} className="team-player">
                      <span>{p.name}</span>
                      <strong>{score(p)}</strong>
                    </div>
                  ))}
                </div>
              ))}

              {injured.length > 0 && (
                <div className="card full">
                  <h3>Blessés / à part</h3>
                  <p className="muted">{injured.map((p) => p.name).join(", ")}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
