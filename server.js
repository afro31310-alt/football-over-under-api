const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

const API_URL = "https://v3.football.api-sports.io";


// HOME
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Football Over/Under API is running"
  });
});


// GET FIXTURES
async function getFixtures(date) {

  const response = await fetch(
    `${API_URL}/fixtures?date=${date}`,
    {
      headers: {
        "x-apisports-key": API_KEY
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || `API returned ${response.status}`
    );
  }

  return data.response || [];
}


// MATCHES
app.get("/api/matches", async (req, res) => {

  try {

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API_FOOTBALL_KEY is missing"
      });
    }

    const matches = [];

    const today = new Date();

    // Check today and the next 6 days
    for (let i = 0; i < 7; i++) {

      const date = new Date(today);

      date.setDate(date.getDate() + i);

      const dateString =
        date.toISOString().slice(0, 10);

      const fixtures =
        await getFixtures(dateString);

      for (const fixture of fixtures) {

        const status =
          fixture.fixture?.status?.short;

        // Only upcoming matches
        if (
          status !== "NS" &&
          status !== "TBD"
        ) {
          continue;
        }

        matches.push({

          id: fixture.fixture.id,

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

          status: status || "NS",

          // Over markets
          over05: 90,
          over15: 75,
          over25: 55,
          over35: 35,

          // Under markets
          under15: 25,
          under25: 45,
          under35: 65

        });
      }
    }


    // Remove duplicate matches
    const uniqueMatches =
      Array.from(
        new Map(
          matches.map(match => [
            match.id,
            match
          ])
        ).values()
      );


    // Sort by match time
    uniqueMatches.sort((a, b) => {
      return (
        new Date(a.time) -
        new Date(b.time)
      );
    });


    res.json({

      success: true,

      count:
        uniqueMatches.length,

      matches:
        uniqueMatches

    });


  } catch (error) {

    console.error(error);

    res.status(500).json({

      success: false,

      message:
        "Unable to load football matches",

      error:
        error.message

    });

  }

});


// HEALTH
app.get("/health", (req, res) => {

  res.json({
    status: "OK"
  });

});


// START SERVER
app.listen(PORT, () => {

  console.log(
    `Football Over/Under API running on port ${PORT}`
  );

});
