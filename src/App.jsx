
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

const stats = [
  { key: "tec", label: "TEC", full: "Technique" },
  { key: "tir", label: "TIR", full: "Finition" },
  { key: "def", label: "DEF", full: "Défense" },
  { key: "phy", label: "PHY", full: "Physique" },
  { key: "vit", label: "VIT", full: "Vitesse" },
  { key: "col", label: "COL", full: "Collectif" },
];

function defaultRatings() {
  return Object.fromEntries(stats.map((s) => [s.key, 60]));
}

function overall(player) {
  const values = stats.map((s) => Number(player[s.key] || 0));
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  if (player.status === "Blessé") return Math.round(avg * 0.45);
  if (player.status === "Incertain") return Math.round(avg * 0.78);
  return avg;
}

function balanceTeams(players, teamCount = 2) {
  const available = players
    .filter((p) => p.status !== "Blessé")
    .sort((a, b) => overall(b) - overall(a));

  const teams = Array.from({ length: teamCount }, (_, i) => ({
    name: `Équipe ${i + 1}`,
    players: [],
    total: 0,
  }));

  for (const player of available) {
    teams.sort((a, b) => a.total - b.total || a.players.length - b.players.length);
    teams[0].players.push(player);
    teams[0].total += overall(player);
  }

  return teams;
}

async function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 420;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getCardClass(rating) {
  if (rating >= 85) return "card-fifa elite";
  if (rating >= 75) return "card-fifa gold";
  if (rating >= 65) return "card-fifa silver";
  return "card-fifa bronze";
}

function PlayerCard({ player, onDelete, onStatus }) {
  const note = overall(player);
  return (
    <div className={getCardClass(note)}>
      <div className="card-shine" />
      <div className="fifa-top">
        <div>
          <div className="overall">{note}</div>
          <div className="position">FIVE</div>
        </div>
        <div className={`badge ${player.status === "OK" ? "ok" : player.status === "Incertain" ? "maybe" : "injured"}`}>
          {player.status || "OK"}
        </div>
      </div>

      <div className="photo-wrap">
        {player.photo ? <img src={player.photo} alt={player.name} /> : <div className="photo-empty">⚽</div>}
      </div>

      <h3 className="card-name">{player.name}</h3>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.key}>
            <strong>{player[s.key]}</strong> <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="card-actions">
        <select value={player.status || "OK"} onChange={(e) => onStatus(player, e.target.value)}>
          <option>OK</option>
          <option>Incertain</option>
          <option>Blessé</option>
        </select>
        <button onClick={() => onDelete(player)}>✕</button>
      </div>
    </div>
  );
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [tab, setTab] = useState("cards");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("OK");
  const [ratings, setRatings] = useState(defaultRatings());
  const [photo, setPhoto] = useState("");
  const [teamCount, setTeamCount] = useState(2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "players"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPlayers(data.sort((a, b) => overall(b) - overall(a)));
    });
    return () => unsubscribe();
  }, []);

  const teams = useMemo(() => balanceTeams(players, teamCount), [players, teamCount]);
  const injured = players.filter((p) => p.status === "Blessé");

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setPhoto(dataUrl);
  }

  async function submitPlayer(e) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || saving) return;

    setSaving(true);
    try {
      await addDoc(collection(db, "players"), {
        name: cleanName,
        status,
        photo,
        ...ratings,
        createdAt: serverTimestamp(),
      });

      setName("");
      setStatus("OK");
      setRatings(defaultRatings());
      setPhoto("");
      setTab("cards");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(player, nextStatus) {
    await updateDoc(doc(db, "players", player.id), { status: nextStatus });
  }

  async function removePlayer(player) {
    await deleteDoc(doc(db, "players", player.id));
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="brand">⚽ FiveDraft</p>
          <h1>Cartes FIFA du Five</h1>
          <p className="muted">Chaque joueur se note, ajoute sa photo, puis on génère des équipes équilibrées.</p>
        </div>
        <nav>
          <button className={tab === "form" ? "active" : ""} onClick={() => setTab("form")}>Se noter</button>
          <button className={tab === "cards" ? "active" : ""} onClick={() => setTab("cards")}>Cartes</button>
          <button className={tab === "teams" ? "active" : ""} onClick={() => setTab("teams")}>Équipes</button>
        </nav>
      </header>

      {tab === "form" && (
        <main className="form-layout">
          <section className="panel">
            <h2>Créer ma carte</h2>
            <p className="muted">Notes de 40 à 99, comme FIFA. Soyez honnêtes sinon les équipes seront éclatées.</p>

            <form onSubmit={submitPlayer} className="form">
              <div>
                <label>Prénom / surnom</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Alan" />
              </div>

              <div>
                <label>Photo</label>
                <input type="file" accept="image/*" onChange={handlePhoto} />
                <p className="hint">Photo compressée automatiquement.</p>
              </div>

              <div>
                <label>Statut</label>
                <div className="status-grid">
                  {["OK", "Incertain", "Blessé"].map((s) => (
                    <button type="button" key={s} onClick={() => setStatus(s)} className={`status ${status === s ? "selected" : ""}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {stats.map((s) => (
                <div key={s.key} className="rating">
                  <div className="rating-top">
                    <label>{s.full}</label>
                    <span>{ratings[s.key]}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="99"
                    value={ratings[s.key]}
                    onChange={(e) => setRatings({ ...ratings, [s.key]: Number(e.target.value) })}
                  />
                  <div className="scale"><span>40</span><span>60</span><span>80</span><span>99</span></div>
                </div>
              ))}

              <button className="primary" disabled={saving}>{saving ? "Envoi..." : "Créer ma carte"}</button>
            </form>
          </section>

          <section className="preview">
            <PlayerCard
              player={{ name: name || "TON NOM", status, photo, ...ratings }}
              onDelete={() => {}}
              onStatus={(_, s) => setStatus(s)}
            />
          </section>
        </main>
      )}

      {tab === "cards" && (
        <main>
          <div className="section-title">
            <div>
              <h2>Toutes les cartes</h2>
              <p className="muted">{players.length} joueur(s) inscrit(s)</p>
            </div>
            <button className="primary small-btn" onClick={() => setTab("form")}>+ Ajouter ma carte</button>
          </div>

          <div className="cards-grid">
            {players.length === 0 && <p className="muted">Aucune carte pour l’instant.</p>}
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} onDelete={removePlayer} onStatus={updateStatus} />
            ))}
          </div>
        </main>
      )}

      {tab === "teams" && (
        <main>
          <div className="section-title">
            <div>
              <h2>Équipes équilibrées</h2>
              <p className="muted">Les blessés sont exclus. Les incertains comptent moins fort.</p>
            </div>
            <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>
              <option value={2}>2 équipes</option>
              <option value={3}>3 équipes</option>
              <option value={4}>4 équipes</option>
            </select>
          </div>

          <div className="teams-grid">
            {teams.map((team) => (
              <section key={team.name} className="team-panel">
                <h3>{team.name}</h3>
                <p className="team-total">Total : {team.total}</p>
                <div className="team-list">
                  {team.players.map((p) => (
                    <div key={p.id} className="team-row">
                      <span>{p.name}</span>
                      <strong>{overall(p)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {injured.length > 0 && (
              <section className="team-panel injured-panel">
                <h3>Blessés / à part</h3>
                <p className="muted">{injured.map((p) => p.name).join(", ")}</p>
              </section>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
