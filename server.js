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
// FORMAT DATE
// ==============================

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}


// ==============================
// GET FIXTURES
// ==============================

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
      data.message ||
      `API returned ${response.status}`
    );
  }

  return data.response || [];
}


// ==============================
// MATCHES
// ==============================

app.get("/api/matches", async (req, res) => {

  try {

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API_FOOTBALL_KEY is missing"
      });
    }


    /*
      If a date is supplied:

      /api/matches?date=2026-09-24

      use that exact date.

      Otherwise check today + next 6 days.
    */

    let dates = [];


    if (req.query.date) {

      dates = [req.query.date];

    } else {

      const today = new Date();

      for (let i = 0; i < 7; i++) {

        const date = new Date(today);

        date.setUTCDate(
          date.getUTCDate() + i
        );

        dates.push(
          formatDate(date)
        );

      }

    }


    const matches = [];


    for (const date of dates) {

      console.log(
        `Checking fixtures for ${date}`
      );


      const fixtures =
        await getFixtures(date);


      for (const fixture of fixtures) {

        const status =
          fixture.fixture?.status?.short;


        /*
          Keep upcoming fixtures.
        */

        if (
          status !== "NS" &&
          status !== "TBD"
        ) {
          continue;
        }


        matches.push({

          id:
            fixture.fixture.id,

          league:
            fixture.league?.name ||
            "Football",

          country:
            fixture.league?.country ||
            "",

          home:
            fixture.teams?.home?.name ||
            "Home Team",

          away:
            fixture.teams?.away?.name ||
            "Away Team",

          time:
            fixture.fixture?.date ||
            "",

          status:
            status || "NS",


          /*
            Temporary prediction percentages.
            We will replace these with
            statistical calculations later.
          */

          over05: 90,
          over15: 75,
          over25: 55,
          over35: 35,

          under15: 25,
          under25: 45,
          under35: 65

        });

      }

    }


    /*
      Remove duplicates.
    */

    const uniqueMatches =
      Array.from(
        new Map(
          matches.map(match => [
            match.id,
            match
          ])
        ).values()
      );


    /*
      Sort by kickoff time.
    */

    uniqueMatches.sort((a, b) => {

      return (
        new Date(a.time) -
        new Date(b.time)
      );

    });


    res.json({

      success: true,

      datesChecked: dates,

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

});


// ==============================
// HEALTH CHECK
// ==============================

app.get("/health", (req, res) => {

  res.json({
    status: "OK"
  });

});


// ==============================
// START
// ==============================

app.listen(PORT, () => {

  console.log(
    `Football Over/Under API running on port ${PORT}`
  );

});
