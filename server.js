const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

const API_URL = "https://v3.football.api-sports.io";


/* ==============================
   HOME
============================== */

app.get("/", (req, res) => {

  res.json({
    success: true,
    message: "Football Over/Under API is running"
  });

});


/* ==============================
   FORMAT DATE
============================== */

function formatDate(date) {

  const year = date.getUTCFullYear();

  const month =
    String(date.getUTCMonth() + 1).padStart(2, "0");

  const day =
    String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


/* ==============================
   GET FIXTURES FOR ONE DATE
============================== */

async function getFixtures(date) {

  const response = await fetch(
    `${API_URL}/fixtures?date=${date}&status=NS`,
    {
      headers: {
        "x-apisports-key": API_KEY
      }
    }
  );


  if (!response.ok) {

    throw new Error(
      `Football API returned ${response.status}`
    );

  }


  const data = await response.json();

  return data.response || [];

}


/* ==============================
   MATCHES
============================== */

app.get("/api/matches", async (req, res) => {

  try {

    if (!API_KEY) {

      return res.status(500).json({

        success: false,

        message:
          "API_FOOTBALL_KEY is not configured"

      });

    }


    /*
      We check today and the next two days.

      This prevents the website from becoming
      empty when today's football schedule is small.
    */

    const requestedDate = req.query.date;


    let startDate;

    if (requestedDate) {

      startDate = new Date(
        `${requestedDate}T00:00:00Z`
      );

    } else {

      startDate = new Date();

    }


    const allFixtures = [];


    for (let i = 0; i < 3; i++) {

      const date = new Date(startDate);

      date.setUTCDate(
        date.getUTCDate() + i
      );


      const dateString =
        formatDate(date);


      console.log(
        `Getting fixtures for ${dateString}`
      );


      const fixtures =
        await getFixtures(dateString);


      allFixtures.push(...fixtures);

    }


    /*
      Remove duplicate fixture IDs.
    */

    const uniqueFixtures =
      Array.from(
        new Map(
          allFixtures.map(
            fixture => [
              fixture.fixture.id,
              fixture
            ]
          )
        ).values()
      );


    /*
      Only keep matches that have not started.
    */

    const upcoming =
      uniqueFixtures.filter(fixture => {

        const status =
          fixture.fixture?.status?.short;

        return [
          "NS",
          "TBD"
        ].includes(status);

      });


    /*
      Convert API data into website format.
    */

    const matches =
      upcoming.map(match => {

        return {

          id: match.fixture.id,

          league:
            match.league?.name ||
            "Football",

          country:
            match.league?.country ||
            "",

          home:
            match.teams?.home?.name ||
            "Home Team",

          away:
            match.teams?.away?.name ||
            "Away Team",

          time:
            match.fixture?.date ||
            "",

          status:
            match.fixture?.status?.short ||
            "NS",


          /*
            These are temporary estimates.

            We will replace them with the
            statistical prediction engine next.
          */

          over05: 90,

          over15: 75,

          over25: 55,

          over35: 35,

          under15: 25,

          under25: 45,

          under35: 65

        };

      });


    /*
      Sort by match time.
    */

    matches.sort((a, b) => {

      return new Date(a.time) -
             new Date(b.time);

    });


    res.json({

      success: true,

      count: matches.length,

      matches: matches

    });


  } catch (error) {

    console.error(
      "MATCH ERROR:",
      error
    );


    res.status(500).json({

      success: false,

      message: "Unable to load football matches",

      error: error.message

    });

  }

});


/* ==============================
   HEALTH CHECK
============================== */

app.get("/health", (req, res) => {

  res.json({
    status: "OK"
  });

});


/* ==============================
   START SERVER
============================== */

app.listen(PORT, () => {

  console.log(
    `Football Over/Under API running on port ${PORT}`
  );

});
