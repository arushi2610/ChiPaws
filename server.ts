import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

// In-memory store for demo purposes
const certificates: Record<string, { id: string; amount: number; date: string; name: string }> = {};

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
        name: session.customer_details?.name || "Anonymous ChiPaws Supporter"
      };
      console.log(`ChiPaws Certificate generated: ${certId}`);
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
                name: "Donation to ChiPaws Chicago",
                description: "Helping rescue dogs in Chicago find forever homes.",
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
    console.log(`ChiPaws Server running on http://localhost:${PORT}`);
  });
}

startServer();
