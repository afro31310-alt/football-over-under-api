const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = "https://api.football-data.org/v4";
const TOKEN = process.env.FOOTBALL_DATA_TOKEN;

app.use(express.json());
app.use(express.static(__dirname));

let cache = {
  data: null,
  time: 0
};

const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const d = new Date(dateString + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
    throw new Error(`Football API ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

/* -----------------------------------
   POISSON CALCULATIONS
----------------------------------- */

function poissonProbability(lambda, goals) {
  if (lambda <= 0) {
    return goals === 0 ? 1 : 0;
  }

  let probability = Math.exp(-lambda);

  for (let i = 1; i <= goals; i++) {
    probability *= lambda / i;
  }

  return probability;
}

function overProbability(lambda, line) {
  const maxGoals = Math.floor(line);

  let underOrEqual = 0;

  for (let i = 0; i <= maxGoals; i++) {
    underOrEqual += poissonProbability(lambda, i);
  }

  return 1 - underOrEqual;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* -----------------------------------
   BUILD TEAM STATISTICS
----------------------------------- */

function createTeamStats(matches) {
  const teams = {};

  function getTeam(id) {
    if (!teams[id]) {
      teams[id] = {
        games: 0,

        homeGames: 0,
        awayGames: 0,

        homeFor: 0,
        homeAgainst: 0,

        awayFor: 0,
        awayAgainst: 0,

        totalGoals: 0,

        over05: 0,
        over15: 0,
        over25: 0,
        over35: 0
      };
    }

    return teams[id];
  }

  for (const match of matches) {
    if (!match.homeTeam?.id || !match.awayTeam?.id) continue;

    const homeGoals = match.score?.fullTime?.home;
    const awayGoals = match.score?.fullTime?.away;

    if (
      typeof homeGoals !== "number" ||
      typeof awayGoals !== "number"
    ) {
      continue;
    }

    const totalGoals = homeGoals + awayGoals;

    const home = getTeam(match.homeTeam.id);
    const away = getTeam(match.awayTeam.id);

    home.games++;
    home.homeGames++;
    home.homeFor += homeGoals;
    home.homeAgainst += awayGoals;
    home.totalGoals += totalGoals;

    away.games++;
    away.awayGames++;
    away.awayFor += awayGoals;
    away.awayAgainst += homeGoals;
    away.totalGoals += totalGoals;

    if (totalGoals > 0) {
      home.over05++;
      away.over05++;
    }

    if (totalGoals > 1) {
      home.over15++;
      away.over15++;
    }

    if (totalGoals > 2) {
      home.over25++;
      away.over25++;
    }

    if (totalGoals > 3) {
      home.over35++;
      away.over35++;
    }
  }

  return teams;
}

/* -----------------------------------
   CALCULATE PREDICTION
----------------------------------- */

function calculatePrediction(match, teams) {
  const homeId = match.homeTeam?.id;
  const awayId = match.awayTeam?.id;

  const home = teams[homeId];
  const away = teams[awayId];

  // Fallback if there is not enough historical data
  if (!home || !away || home.games < 2 || away.games < 2) {
    return {
      over05: 80,
      over15: 65,
      over25: 50,
      over35: 30,
      under15: 35,
      under25: 50,
      under35: 70,
      expectedGoals: 2.3,
      model: "Limited historical data"
    };
  }

  /*
    Estimate expected home goals from:

    Home team's scoring at home
    +
    Away team's conceding away
  */

  let homeScoring =
    home.homeGames > 0
      ? home.homeFor / home.homeGames
      : home.totalGoals / home.games / 2;

  let awayConceding =
    away.awayGames > 0
      ? away.awayAgainst / away.awayGames
      : away.totalGoals / away.games / 2;

  /*
    Estimate expected away goals from:

    Away team's scoring away
    +
    Home team's conceding at home
  */

  let awayScoring =
    away.awayGames > 0
      ? away.awayFor / away.awayGames
      : away.totalGoals / away.games / 2;

  let homeConceding =
    home.homeGames > 0
      ? home.homeAgainst / home.homeGames
      : home.totalGoals / home.games / 2;

  let expectedHome =
    (homeScoring + awayConceding) / 2;

  let expectedAway =
    (awayScoring + homeConceding) / 2;

  /*
    Keep the estimate within a sensible range.
  */

  expectedHome = clamp(expectedHome, 0.15, 4.5);
  expectedAway = clamp(expectedAway, 0.15, 4.5);

  const expectedGoals = expectedHome + expectedAway;

  /*
    Poisson probabilities
  */

  const poissonOver05 = overProbability(expectedGoals, 0.5);
  const poissonOver15 = overProbability(expectedGoals, 1.5);
  const poissonOver25 = overProbability(expectedGoals, 2.5);
  const poissonOver35 = overProbability(expectedGoals, 3.5);

  const poissonUnder15 = 1 - poissonOver15;
  const poissonUnder25 = 1 - poissonOver25;
  const poissonUnder35 = 1 - poissonOver35;

  /*
    Recent historical percentages
  */

  const recentOver05 =
    ((home.over05 / home.games) +
      (away.over05 / away.games)) / 2;

  const recentOver15 =
    ((home.over15 / home.games) +
      (away.over15 / away.games)) / 2;

  const recentOver25 =
    ((home.over25 / home.games) +
      (away.over25 / away.games)) / 2;

  const recentOver35 =
    ((home.over35 / home.games) +
      (away.over35 / away.games)) / 2;

  /*
    Blend Poisson model with recent form.

    70% statistical model
    30% recent historical results
  */

  const over05 =
    poissonOver05 * 0.7 +
    recentOver05 * 0.3;

  const over15 =
    poissonOver15 * 0.7 +
    recentOver15 * 0.3;

  const over25 =
    poissonOver25 * 0.7 +
    recentOver25 * 0.3;

  const over35 =
    poissonOver35 * 0.7 +
    recentOver35 * 0.3;

  const under15 = 1 - over15;
  const under25 = 1 - over25;
  const under35 = 1 - over35;

  return {
    over05: Math.round(clamp(over05 * 100, 1, 99)),
    over15: Math.round(clamp(over15 * 100, 1, 99)),
    over25: Math.round(clamp(over25 * 100, 1, 99)),
    over35: Math.round(clamp(over35 * 100, 1, 99)),

    under15: Math.round(clamp(under15 * 100, 1, 99)),
    under25: Math.round(clamp(under25 * 100, 1, 99)),
    under35: Math.round(clamp(under35 * 100, 1, 99)),

    expectedGoals: Number(expectedGoals.toFixed(2)),

    model: "Recent form + Poisson"
  };
}

/* -----------------------------------
   GET UPCOMING MATCHES
----------------------------------- */

async function getUpcomingMatches() {
  const today = todayUTC();
  const future = addDays(today, 7);

  const data = await footballAPI(
    `/matches?dateFrom=${today}&dateTo=${future}`
  );

  return (data.matches || []).filter(match => {
    return (
      match.status === "SCHEDULED" ||
      match.status === "TIMED"
    );
  });
}

/* -----------------------------------
   GET RECENT FINISHED MATCHES
----------------------------------- */

async function getRecentFinishedMatches() {
  const today = todayUTC();

  // Look back approximately 60 days.
  const past = addDays(today, -60);

  const data = await footballAPI(
    `/matches?dateFrom=${past}&dateTo=${today}&status=FINISHED`
  );

  return data.matches || [];
}

/* -----------------------------------
   API ROUTE
----------------------------------- */

app.get("/api/matches", async (req, res) => {
  try {
    const now = Date.now();

    /*
      Use cached predictions for 10 minutes.
      This reduces API requests and helps avoid
      the football-data.org rate limit.
    */

    if (
      cache.data &&
      now - cache.time < CACHE_TIME
    ) {
      return res.json(cache.data);
    }

    const upcoming = await getUpcomingMatches();

    const recent = await getRecentFinishedMatches();

    const teamStats = createTeamStats(recent);

    const matches = upcoming.map(match => {
      const prediction = calculatePrediction(
        match,
        teamStats
      );

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
          match.homeTeam?.id || null,

        awayTeamId:
          match.awayTeam?.id || null,

        time:
          match.utcDate,

        status:
          match.status,

        over05: prediction.over05,
        over15: prediction.over15,
        over25: prediction.over25,
        over35: prediction.over35,

        under15: prediction.under15,
        under25: prediction.under25,
        under35: prediction.under35,

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
      time: now
    };

    res.json(result);

  } catch (error) {

    console.error(
      "Prediction error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Unable to load football predictions",
      error: error.message
    });
  }
});

/* -----------------------------------
   HEALTH CHECK
----------------------------------- */

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    service: "Football Prediction API"
  });
});

/* -----------------------------------
   HOME PAGE
----------------------------------- */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/* -----------------------------------
   START SERVER
----------------------------------- */

app.listen(PORT, () => {
  console.log(
    `Football prediction server running on port ${PORT}`
  );
});
