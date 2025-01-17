const jwt = require('../token/jwt');
const data = require('../models/index');
const popular = require('./popular.ctrl');
const { PythonShell } = require('python-shell');
const http = require('http');

const NUMOFRECOMMEND = 10;
const NUMOFJOINED = 4;
const MINRANK = 1;
const MAXRANK = 10;

async function getUserName(userNo) {
  const userInfo = await data.user.get('no', userNo);
  const name = userInfo[0].nickname;
  return name;
}

async function getParticipants(routineId) {
  var participants = 0;

  const userRoutines = await data.user_routine.get('routine_id', routineId);
  for (const routine of userRoutines) {
    if (routine.type == 'join') {
      participants++;
    }
  }

  return participants;
}

const ai = {
  recommendRoutine: (userNo, res) => {
    return new Promise((resolve, reject) => {
      var options = {
        // host:'20.214.203.40',
        // port:'8080',
        host: 'ai',
        port: '4000',
        path: '/?no=' + userNo + '',
      };

      var req = http.get(options, function (res) {
        var resData = '';
        res.on('data', function (chunk) {
          resData += chunk;
        });

        res.on('end', function () {
          resolve(resData);
        });
      });
    });
  },

  recommendRefresh: (userNo, refreshNum, res) => {
    return new Promise((resolve, reject) => {
      var options = {
        // host:'20.214.203.40',
        // port:'8080',
        host: 'ai',
        port: '4000',
        path: '/?no=' + userNo + '&refresh=' + refreshNum + '',
      };

      var req = http.get(options, function (res) {
        var resData = '';
        res.on('data', function (chunk) {
          resData += chunk;
        });

        res.on('end', function () {
          resolve(resData);
        });
      });
    });
  },
};

const token = {
  isToken: (req, res) => {
    if (req.headers.authorization && req.headers.authorization.split(' ')[1]) {
      return true;
    } else {
      return false;
    }
  },

  decode: (req, res) => {
    const jwtToken = req.headers.authorization.split(' ')[1];
    const decoded = jwt.token.decode(jwtToken);
    return decoded;
  },
};

const output = {
  home: async (req, res) => {
    const userRoutines = await data.user_routine.getAll();
    const JoinedRoutine = popular.process.sortRank(userRoutines);

    // 인기 루틴
    var rankedRoutine = [];

    for (var rank = MINRANK; rank <= MAXRANK; ++rank) {
      const routine = await data.routine.get('id', JoinedRoutine[rank - 1][0]);
      routine[0].participants = JoinedRoutine[rank - 1][1];
      const userInfo = await data.user.get('no', routine[0].host);
      routine[0].hostName = userInfo[0].nickname;
      rankedRoutine.push(routine[0]);
    }

    if (!token.isToken(req, res)) {
      const randomRoutine = await data.routine.getRandom(NUMOFRECOMMEND);

      for (const item of randomRoutine) {
        item.hostName = await getUserName(item.host);
        item.participants = await getParticipants(item.id);
      }

      return res.json({
        success: true,
        isLogin: false,
        rankedRoutine: rankedRoutine,
        recommendRoutine: randomRoutine,
      });
    }

    //로그인 되었을 때
    const decoded = token.decode(req, res);
    const userInfo = await data.user.get('id', decoded.id);

    // 추천 routine
    if (!req.query.refresh) {
      var recommendNo = await ai.recommendRoutine(decoded.no, res);
    } else {
      var recommendNo = await ai.recommendRefresh(decoded.no, req.query.refresh, res);
    }

    recommendNo = recommendNo.substr(1, recommendNo.length - 3);
    recommendNo = recommendNo.split(',');

    for (var i = 0; i < recommendNo.length; ++i) {
      recommendNo[i] = Number(recommendNo[i]);
    }

    var recommendRoutine = [];
    for (const no of recommendNo) {
      const aiRoutine = await data.routine.get('id', no);
      const hostName = await data.user.get('no', aiRoutine[0].host);
      aiRoutine[0].hostName = hostName[0].nickname;
      aiRoutine[0].participants = await getParticipants(no);

      recommendRoutine.push(aiRoutine[0]);
    }

    const authRoutine = await data.auth.getOrderByDate('user_no', decoded.no, NUMOFJOINED);

    var currentRoutines = [];
    for (const item of authRoutine) {
      const currentRoutine = await data.routine.get('id', authRoutine[0].routine_id);
      currentRoutines.push(currentRoutine[0]);
    }

    res.json({
      success: true,
      isLogin: true,
      user: userInfo[0],
      rankedRoutine: rankedRoutine,
      recommendRoutine: recommendRoutine,
      currentRoutine: currentRoutines,
    });
  },
};

module.exports = {
  output,
};
