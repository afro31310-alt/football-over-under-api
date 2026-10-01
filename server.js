const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve the website
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;

const API_URL = "https://api.football-data.org/v4";

// WEBSITE
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// FOOTBALL MATCHES
app.get("/api/matches", async (req, res) => {
  try {
    if (!FOOTBALL_DATA_TOKEN) {
      return res.status(500).json({
        success: false,
        message: "FOOTBALL_DATA_TOKEN is missing"
      });
    }

    const today = new Date();

    const future = new Date();
    future.setDate(future.getDate() + 7);

    const dateFrom = today.toISOString().slice(0, 10);
    const dateTo = future.toISOString().slice(0, 10);

    const url =
      `${API_URL}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_TOKEN
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Football API error:", data);

      return res.status(response.status).json({
        success: false,
        message: "Football data provider error",
        error: data
      });
    }

    const matches = (data.matches || [])
      .filter(match => {
        return (
          match.status === "SCHEDULED" ||
          match.status === "TIMED"
        );
      })
      .map(match => ({
        id: match.id,
        league: match.competition?.name || "Football",
        country: match.area?.name || "",
        home: match.homeTeam?.name || "Home",
        away: match.awayTeam?.name || "Away",
        time: match.utcDate || "",
        status: match.status || "SCHEDULED",

        over05: 90,
        over15: 75,
        over25: 55,
        over35: 35,

        under15: 25,
        under25: 45,
        under35: 65
      }));

    matches.sort((a, b) => {
      return new Date(a.time) - new Date(b.time);
    });

    res.json({
      success: true,
      count: matches.length,
      dateFrom: dateFrom,
      dateTo: dateTo,
      matches: matches
    });

  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load football matches",
      error: error.message
    });
  }
});

// HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({
    status: "OK"
  });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Football API running on port ${PORT}`);
});


  
