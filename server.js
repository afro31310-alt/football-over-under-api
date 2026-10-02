const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const API_BASE = "https://api.football-data.org/v4";
const TOKEN = process.env.FOOTBALL_DATA_TOKEN;

app.use(express.json());
app.use(express.static(__dirname));

let cache = {
  data: null,
  time: 0
};

const CACHE_TIME = 10 * 60 * 1000;

/* =========================
   FOOTBALL API
========================= */

async function footballAPI(endpoint) {
  if (!TOKEN) {
    throw new Error("FOOTBALL_DATA_TOKEN is missing");
  }

  const response = await fetch(API_BASE + endpoint, {
    headers: {
      "X-Auth-Token": TOKEN
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Football API ${response.status}: ${text}`
    );
  }

  return JSON.parse(text);
}

/* =========================
   DATES
========================= */

function getDate(daysFromToday = 0) {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() + daysFromToday
  );

  return date.toISOString().slice(0, 10);
}

/* =========================
   SIMPLE MODEL
========================= */

function basicPrediction() {
  return {
    over05: 88,
    over15: 72,
    over25: 54,
    over35: 34,

    under15: 28,
    under25: 46,
    under35: 66,

    expectedGoals: 2.35,

    model: "Football prediction model"
  };
}

/* =========================
   HOME PAGE
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK"
  });
});

/* =========================
   MATCHES
========================= */

app.get("/api/matches", async (req, res) => {

  try {

    console.log("Loading upcoming matches...");

    /* Get only upcoming matches first.
       This is the important request. */

    const today = getDate(0);
    const nextWeek = getDate(7);

    const data = await footballAPI(
      `/matches?dateFrom=${today}&dateTo=${nextWeek}`
    );

    const upcoming = (data.matches || []).filter(
      match =>
        match.status === "SCHEDULED" ||
        match.status === "TIMED"
    );

    console.log(
      `Found ${upcoming.length} upcoming matches`
    );

    /* =========================
       CREATE RESULTS
    ========================= */

    const matches = upcoming.map(match => {

      const prediction = basicPrediction();

      return {

        id: match.id,

        league:
          match.competition?.name ||
          "Football",

        country:
          match.area?.name ||
          "",

        home:
          match.homeTeam?.name ||
          "Home",

        away:
          match.awayTeam?.name ||
          "Away",

        homeTeamId:
          match.homeTeam?.id ||
          null,

        awayTeamId:
          match.awayTeam?.id ||
          null,

        time:
          match.utcDate,

        status:
          match.status,

        over05:
          prediction.over05,

        over15:
          prediction.over15,

        over25:
          prediction.over25,

        over35:
          prediction.over35,

        under15:
          prediction.under15,

        under25:
          prediction.under25,

        under35:
          prediction.under35,

        expectedGoals:
          prediction.expectedGoals,

        model:
          prediction.model
      };
    });

    const result = {
      success: true,

      generatedAt:
        new Date().toISOString(),

      count:
        matches.length,

      matches
    };

    cache = {
      data: result,
      time: Date.now()
    };

    res.json(result);

  } catch (error) {

    console.error(
      "MATCH ERROR:",
      error.message
    );

    /* If we have previously loaded matches,
       return those instead of breaking the site. */

    if (cache.data) {

      console.log(
        "Returning cached matches"
      );

      return res.json(cache.data);
    }

    res.status(500).json({

      success: false,

      message:
        "Unable to load football matches",

      error:
        error.message
    });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {

  console.log(
    `Football API running on port ${PORT}`
  );

});

