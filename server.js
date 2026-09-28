const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

const API_URL = "https://v3.football.api-sports.io";


// ==============================
// HOME
// ==============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Football Over/Under API is running"
  });
});


// ==============================
// HEALTH
// ==============================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK"
  });
});


// ==============================
// GET FIXTURES FROM API-FOOTBALL
// ==============================

async function getFixtures(from, to) {

  if (!API_KEY) {
    throw new Error("API_FOOTBALL_KEY is missing");
  }

  const url =
    `${API_URL}/fixtures?from=${from}&to=${to}&timezone=UTC`;

  console.log(`Checking fixtures from ${from} to ${to}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": API_KEY,
      "Accept": "application/json"
    }
  });

  const data = await response.json();

  console.log(
    "API-FOOTBALL results:",
    data.results
  );

  if (!response.ok) {
    throw new Error(
      data.message ||
      `API returned HTTP ${response.status}`
    );
  }

  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error("API errors:", data.errors);

    throw new Error(
      JSON.stringify(data.errors)
    );
  }

  return data.response || [];
}


// ==============================
// FORMAT MATCH
// ==============================

function formatMatch(fixture) {

  const status =
    fixture.fixture?.status?.short || "NS";

  return {

    id: fixture.fixture?.id,

    league:
      fixture.league?.name || "Football",

    country:
      fixture.league?.country || "",

    home:
      fixture.teams?.home?.name || "Home",

    away:
      fixture.teams?.away?.name || "Away",

    time:
      fixture.fixture?.date || "",

    status: status,

    // Current Over/Under estimates
    over05: 90,
    over15: 75,
    over25: 55,
    over35: 35,

    under15: 25,
    under25: 45,
    under35: 65
  };
}


// ==============================
// MATCHES
// ==============================

async function matchesHandler(req, res) {

  try {

    if (!API_KEY) {

      return res.status(500).json({
        success: false,
        message: "API_FOOTBALL_KEY is missing"
      });

    }

    // Today's date
    const today = new Date();

    const from =
      today.toISOString().slice(0, 10);

    // 14 days ahead
    const future =
      new Date(today);

    future.setDate(
      future.getDate() + 14
    );

    const to =
      future.toISOString().slice(0, 10);


    // Get fixtures
    const fixtures =
      await getFixtures(from, to);


    console.log(
      `API returned ${fixtures.length} fixtures`
    );


    // Keep upcoming fixtures only
    const matches = fixtures
      .filter(fixture => {

        const status =
          fixture.fixture?.status?.short;

        return (
          status === "NS" ||
          status === "TBD"
        );

      })
      .map(formatMatch);


    // Remove duplicates
    const uniqueMatches =
      Array.from(
        new Map(
          matches.map(match => [
            match.id,
            match
          ])
        ).values()
      );


    // Sort by kickoff time
    uniqueMatches.sort(
      (a, b) =>
        new Date(a.time) -
        new Date(b.time)
    );


    console.log(
      `Upcoming matches available: ${uniqueMatches.length}`
    );


    res.json({

      success: true,

      from: from,

      to: to,

      count:
        uniqueMatches.length,

      matches:
        uniqueMatches

    });


  } catch (error) {

    console.error(
      "MATCH ERROR:",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Unable to load football matches",

      error:
        error.message

    });

  }

}


// Both URLs work
app.get("/api/matches", matchesHandler);

app.get("/matches", matchesHandler);


// ==============================
// START SERVER
// ==============================

app.listen(PORT, () => {

  console.log(
    `Football Over/Under API running on port ${PORT}`
  );

});
