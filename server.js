import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = "./data/transactions.json";

if (!fs.existsSync("./data")) fs.mkdirSync("./data");
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {}, transactions: [] }, null, 2));

const loadData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

app.get("/health", (req, res) => res.send("✅ UFD Backend is running fine!"));

// ✅ Deposit endpoint
app.post("/api/deposit/autopay", async (req, res) => {
  try {
    const { contact, amount, email } = req.body;
    if (!contact || !amount || !email) return res.status(400).json({ error: "Missing fields" });

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      { email, amount: amount * 100, metadata: { contact } },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    res.json({ authorization_url: response.data.data.authorization_url });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Payment initialization failed" });
  }
});

// ✅ Paystack webhook
app.post("/api/paystack/webhook", express.json({ type: "*/*" }), (req, res) => {
  const event = req.body;
  if (event.event === "charge.success") {
    const { email, amount, metadata } = event.data;
    const contact = metadata?.contact;
    const data = loadData();
    if (!data.users[contact]) data.users[contact] = { balance: 0 };
    data.users[contact].balance += amount / 100;
    data.transactions.push({ type: "deposit", contact, amount: amount / 100, email, time: new Date().toISOString() });
    saveData(data);
  }
  res.sendStatus(200);
});

app.get("/api/transactions", (req, res) => res.json(loadData().transactions));

app.get("/api/info", (req, res) => {
  const data = loadData();
  res.json({ totalUsers: Object.keys(data.users).length, totalTransactions: data.transactions.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));