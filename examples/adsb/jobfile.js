const path = require('path')
const fs = require('fs')

module.exports = {
  id: 'adsb',
  //type: 'kue',
  store: 'memory',
  options: {
    //workersLimit: 1
  },
  tasks: [{
    id: 'adsb-exchange',
    type: 'http',
    options: {
      url: 'http://public-api.adsbexchange.com/VirtualRadar/AircraftList.json',
      fCallS: 'RAM' // Prefilter by callsign of Air Maroc
    }
  }, {
    id: 'opensky-network',
    type: 'http',
    options: {
      url: 'https://opensky-network.org/api/states/all'
    }
  }],
  hooks: {
    tasks: {
      after: {
        readJsonAdsbExchange: {
          hook: 'readJson',
          match: { id: 'adsb-exchange' },
          objectPath: 'acList' // Aircraft list is in this field
        },
        readJsonOpenSkyNetwork: {
          hook: 'readJson',
          match: { id: 'opensky-network' },
          objectPath: 'states' // Aircraft list is in this field
        },
        transformJsonAdsbExchange: {
          hook: 'transformJson',
          match: { id: 'adsb-exchange' },
          filter: { Spd: { $gt: 400 } }, // Keep speed above 400 knots
          mapping: { Spd: 'speed', Call: 'callsign', Lat: 'latitude', Long: 'longitude', Alt: 'altitude', Icao: 'icao' },
          unitMapping: {
            altitude: { from: 'feet', to: 'm' }
          },
          pick: ['latitude', 'longitude', 'altitude', 'callsign', 'icao', 'speed']
        },
        transformJsonOpenSkyNetwork: {
          hook: 'transformJson',
          match: { id: 'opensky-network' },
          // State vectors are given as arrays, see https://opensky-network.org/apidoc/rest.html#response
          toObjects: ['icao', 'callsign', 'origin_country', 'time_position', 'last_contact', 'longitude', 'latitude', 'geo_altitude', 'on_ground', 'velocity', 'heading', 'vertical_rate', 'sensors', 'baro_altitude', 'squawk', 'spi', 'position_source'],
        	filter: { velocity: { $gt: 200 }, callsign: { $regex: '^RAM' } }, // Keep speed above 200 m/s and callsign of Air Maroc
          mapping: { velocity: 'speed', geo_altitude: 'altitude' },
          unitMapping: {
            speed: { from: 'm/s', to: 'kts' }
          },
          pick: ['latitude', 'longitude', 'altitude', 'callsign', 'icao', 'speed']
        }
        /* To debug individual files
        writeJsonFS: {
          hook: 'writeJson',
          store: 'fs'
        },
        writeJsonS3: {
          hook: 'writeJson',
          store: 's3',
          storageOptions: {
            ACL: 'public-read'
          }
        }
        */
      }
    },
    jobs: {
      before: {
        createStores: [{
          id: 'memory'
        }, {
          id: 'fs',
          options: {
            path: path.join(__dirname, '..', 'output')
          }
        }, {
          id: 's3',
          options: {
            client: {
              accessKeyId: process.env.S3_ACCESS_KEY,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
            },
            bucket: process.env.S3_BUCKET
          }
        }]
      },
      after: {
        mergeJson: { by: 'icao' },
        convertToGeoJson: {},
        writeJsonFS: {
          hook: 'writeJson',
          store: 'fs'
        },
        writeJsonS3: {
          hook: 'writeJson',
          store: 's3',
          storageOptions: {
            ACL: 'public-read'
          }
        },
        removeStores: ['memory', 'fs', 's3']
      }
    }
  }
}
