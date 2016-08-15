const ipc         = require('electron').ipcRenderer

const header      = document.getElementById('profile-header')
const usernameH   = document.getElementById('username-h')
const statusH     = document.getElementById('status-h')
const refreshBtn  = document.getElementById('refresh-btn')
const transferBtn = document.getElementById('transfer-btn')
const evolveBtn   = document.getElementById('evolve-btn')
const pokemonList = document.getElementById('pokemon-list')
const sortLinks   = document.querySelectorAll('td[data-sort]')

// Default sort, sort first by pokemon_id then by cp
var currSortings   = ['pokemon_id', 'cp']
var pokemons      = []
var running       = false

var favQueue = [];
window.favoritePokemon = function (pokeId) {
  favQueue.push({ 
    pokeId: pokeId
  });
  checkFavQueue();
}

function checkFavQueue() {
  if (!runningCheck(true) && favQueue.length > 0) {
    var e = favQueue.shift();
    doFavorite(e.pokeId);
  }
}

function doFavorite(pokeId) {
  
  var list = document.querySelectorAll('.poke_' + pokeId + ' .favoriteButton');
  if (list.length === 0) {
    checkFavQueue()
    return;
  }
  var setToFavorite = list[0].className.indexOf('glyphicon-star-empty') > -1
  running = true
  var delay = randomDelay(2, 4);
  ipc.send('favorite-pokemon', pokeId, setToFavorite);
  countDown('Favorite', delay / 1000, true, function () {
  
    var notFavClass = 'glyphicon glyphicon-star-empty'
    var favClass = 'glyphicon glyphicon-star favorite-yellow'
    var newClassName  = 'favoriteButton favorite'

    if (setToFavorite) {
      newClassName = newClassName + ' ' + favClass
    } else {
      newClassName = newClassName + ' ' + notFavClass
    }
    list[0].className = newClassName;
  
    checkFavQueue()
  })
}

var playerInfo    = ipc.sendSync('get-player-info')
if (playerInfo.success) {
  switch (playerInfo.player_data['team']) {
    case 1:
      header.style.backgroundImage = 'url("./imgs/mystic.jpg")'
      break
    case 2:
      header.style.backgroundImage = 'url("./imgs/valor.jpg")'
      break
    case 3:
      header.style.backgroundImage = 'url("./imgs/instinct.jpg")'
      break
  }

  usernameH.innerHTML = playerInfo.player_data['username']

  refreshPokemonList()
} else {
  ipc.send('error-message', 'Failed in retrieving player info.  Please restart.')
}

refreshBtn.addEventListener('click', refreshPokemonList)

transferBtn.addEventListener('click', () => {
  if (runningCheck()) return

  var selectedPokemon = document.querySelectorAll('input[type="checkbox"]:checked')

  if (ipc.sendSync('confirmation-dialog', 'transfer').success) {
    running = true
    var totalDelay = 0;
    selectedPokemon.forEach((pokemon, index) => {
      var delay = randomDelay(3, 6)
      totalDelay += delay;
      ipc.send('transfer-pokemon', pokemon.value, totalDelay)
    })
    countDown('Transfer', totalDelay / 1000)
  }
})

evolveBtn.addEventListener('click', () => {
  if (runningCheck()) return

  var selectedPokemon = document.querySelectorAll('input[type="checkbox"]:checked')

  if (ipc.sendSync('confirmation-dialog', 'evolve').success) {
    running = true
    var totalDelay = 0;
    selectedPokemon.forEach((pokemon, index) => {
      var delay = randomDelay(35, 40);
      totalDelay += delay;
      ipc.send('evolve-pokemon', pokemon.value, totalDelay)
    })
    countDown('Evolve', totalDelay / 1000)
  }
})

for (var i = 0; i < sortLinks.length; i++) {
  sortLinks[i].addEventListener('click', function (e) {
    sortPokemonList(this.dataset.sort)
  })
}

function refreshPokemonList () {
  pokemons = ipc.sendSync('get-players-pokemons')
  if (pokemons.success) sortPokemonList(currSortings[0], true)
}

function sortPokemonList (sorting, refresh) {
  var lastSort = currSortings[0]
  var isSameSort = sorting === lastSort || '-' + sorting ===  lastSort
  newSort = (!refresh && sorting == lastSort ? '-' : '') + sorting

  if (isSameSort) {
    currSortings[0] = newSort
  } else {
    currSortings.pop()
    currSortings.unshift(newSort)
  }

  pokemons.pokemon.sort(sortBy(currSortings))

  pokemonList.innerHTML = ''

  pokemons.pokemon.forEach(poke => {
    var pokeId = poke['id'].toString()
    var checkBox = '<input type="checkbox" value="' + pokeId + '"'
    var favorite = 'glyphicon glyphicon-star-empty'
    var capturedDate = new Date( poke.capturedTime * -1000);

    if (poke['deployed']) checkBox += ' disabled'
    if (poke['favorite']) favorite = 'glyphicon glyphicon-star favorite-yellow'

    pokemonList.innerHTML += '<tr class="poke_' + pokeId + '"><td>' + checkBox + '></td><td><span class="favoriteButton favorite ' + favorite + '" onclick="favoritePokemon(\'' + pokeId + '\')"/></td><td>' + poke['pokemon_id'] + '</td><td>' + poke['name'] + '</td><td>' + poke['nickname'] + '</td><td>' + poke['cp'] + '</td><td>' + poke['iv'] + '% (' + poke['attack'] + '/' + poke['defense'] + '/' + poke['stamina'] + ')</td><td>'+ capturedDate.toLocaleDateString() +'</td></tr>'
  })
}

function runningCheck (noConfirmBox) {
  if (running) {
    if (!noConfirmBox) {
      ipc.send('error-message', 'An action is already running')
    }
    return true
  }
  return false
}

function countDown (method, index, noConfirmBox, cb) {
  index = Math.ceil(index);
  var interval = setInterval(() => {
    statusH.innerHTML = method + ' / ' + index + ' second(s) left'
    index--
    if (index <= 0) {
      clearInterval(interval)
      running = false
      statusH.innerHTML = 'Idle'
      if (!noConfirmBox) {
        ipc.send('error-message', 'Complete!')
      }
      if (cb) {
        cb();
      }
    }
  }, 1000)
}

function randomDelay (min, max) {
  return Math.round((min + Math.random() * (max - min)) * 1000)
}

function sortBy (props) {
  var orders = props.map((prop) => {
    return prop.substr(0, 1) == '-' ? -1 : 1
  })

  props = props.map((prop) => {
    if (prop.substr(0, 1) === '-') prop = prop.substr(1)
    return prop
  })

  function doSort(a, b, i) {
    if (i === props.length) return 0
    return (a[props[i]] < b[props[i]]) ? -1 * orders[i] :
           (a[props[i]] > b[props[i]]) ? 1 * orders[i] :
           doSort(a, b, ++i);
  }

  return function (a, b) {
    return doSort(a, b, 0)
  }
}
