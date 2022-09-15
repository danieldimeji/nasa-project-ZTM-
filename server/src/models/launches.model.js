const axios = require("axios");

const launchesDB = require("./launches.mongo");
const planets = require("./planets.mongo");

const DEFAULT_FLIGHT_NUMBER = 100;

const SPACEX_API_URL = "https://api.spacexdata.com/v4/launches/query";

async function populateLaunches() {
  console.log("Downloading launch data...");
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: "rocket",
          select: {
            name: 1,
          },
        }, 
        {
          path: "payloads",
          select: {
            customers: 1,
          },
        },
      ],
    },
  });

  if (response.status !== 200) {
    console.log('Problem downloading launch data')
    throw new Error('Launch data download failed')
  }

  const launchDocs = response.data.docs;
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc["payloads"];
    const customers = payloads.flatMap((payload) => {
      return payload["customers"];
    });

    const launch = {
      flightNumber: launchDoc["flight_number"],
      mission: launchDoc["name"],
      rocket: launchDoc["rocket"]["name"],
      launchDate: launchDoc["date_local"],
      upcoming: launchDoc["upcoming"],
      success: launchDoc["success"],
      customers: customers,
    };

    console.log(`${launch.flightNumber} ${launch.mission}`);

    await saveLaunch(launch)
  }
}

async function loadLaunchData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: "Falcon 1",
    mission: "FalconSat",
  });

  if (firstLaunch) {
    console.log("Launch data was already loaded");
    return;
  } else {
    await populateLaunches();
  }
}

async function findLaunch(filter) {
  return await launchesDB.findOne(filter);
}

async function existsLaunchWithId(launchId) {
  return await findLaunch({
    flightNumber: launchId,
  });
}

async function getLatestFlightNumber() {
  const latestLaunch = await launchesDB.findOne().sort("-flightNumber");
  if (!latestLaunch) {
    return DEFAULT_FLIGHT_NUMBER;
  }
  return latestLaunch.flightNumber;
}

async function getAllLaunches(skip, limit) {
  // return Array.from(launches.values());
  return await launchesDB
    .find({},{_id: 0, __v: 0,}) // Second argument removes values of unwanted fields (_id, __v) from query
    .sort({flightNumber: 1}) // 1 for ascending order, -1 for descending order
    .skip(skip) // skip documents
    .limit(limit); // no of documents on page
}

async function saveLaunch(launch) {
  await launchesDB.findOneAndUpdate(
    {
      flightNumber: launch.flightNumber,
    },
    launch,
    {
      upsert: true,
    }
  );
  
}

async function scheduleNewLaunch(launch) {
  const planet = await planets.findOne({
    keplerName: launch.target,
  });

  try {
    if (!planet) {
      throw new Error("No matching planet found");
    }
    const newFlightNumber = (await getLatestFlightNumber()) + 1;

    const newLaunch = Object.assign(launch, {
      flightNumber: newFlightNumber,
      success: true,
      upcoming: true,
      customers: ["Zero To Mastery", "NASA"],
    });
    await saveLaunch(newLaunch);
    return {success: true}
  } catch (error) {
    return {success: false}
  }

}

// function addNewLaunch(launch) {
//   latestflightNumber++;
//   launches.set(
//     latestflightNumber,
//     Object.assign(launch, {
//       flightNumber: latestflightNumber,
//       customers: ["Zero To Mastery", "NASA"],
//       upcoming: true,
//       success: true,
//     })
//   );
// }

async function abortLaunchById(launchId) {
  const aborted = await launchesDB.updateOne(
    {
      flightNumber: launchId,
    },
    {
      upcoming: false,
      success: false,
    }
  );
  return aborted.modifiedCount === 1;
}

module.exports = {
  loadLaunchData,
  existsLaunchWithId,
  getAllLaunches,
  scheduleNewLaunch,
  abortLaunchById,
};
