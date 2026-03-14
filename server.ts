import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

// In-memory store for demo purposes (Hackathon style)
const certificates: Record<string, { id: string; amount: number; date: string; name: string }> = {};

let petfinderToken: string | null = null;
let tokenExpiry: number = 0;

async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.warn(`Fetch failed (attempt ${i + 1}), retrying in ${backoff}ms...`, err.message);
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2;
    }
  }
  throw new Error("Max retries reached");
}

async function getPetfinderToken() {
  if (petfinderToken && Date.now() < tokenExpiry) {
    return petfinderToken;
  }

  const response = await fetchWithRetry("https://api.petfinder.com/v2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${process.env.PETFINDER_API_KEY}&client_secret=${process.env.PETFINDER_SECRET}`,
  });

  const data = await response.json() as any;
  if (data.access_token) {
    petfinderToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    return petfinderToken;
  }
  throw new Error("Failed to get Petfinder token");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook (needs raw body)
  app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig!,
        process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder"
      );
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const certId = uuidv4();
      certificates[certId] = {
        id: certId,
        amount: (session.amount_total || 0) / 100,
        date: new Date().toISOString(),
        name: session.customer_details?.name || "Anonymous Supporter"
      };
      console.log(`Certificate generated: ${certId}`);
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // API Routes
  app.post("/api/create-checkout-session", async (req, res) => {
    const { amount } = req.body;
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Donation to ChiPaws",
                description: "Helping rescue dogs in Chicago find homes.",
              },
              unit_amount: amount * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/?canceled=true`,
      });
      res.json({ id: session.id, url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/certificate/:id", (req, res) => {
    const cert = certificates[req.params.id];
    if (!cert) return res.status(404).json({ error: "Certificate not found" });
    res.json(cert);
  });

  app.get("/api/dogs", async (req, res) => {
    try {
      const token = await getPetfinderToken();
      const response = await fetchWithRetry("https://api.petfinder.com/v2/animals?type=dog&location=Chicago,IL&limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Petfinder API error:", err);
      res.status(500).json({ error: "Failed to fetch dogs from Petfinder. Please try again later." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
