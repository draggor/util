/*
 * Actions is an array of functions that accept a callback
 * as an argument.  Each of these functions should return
 * some hook to the async action so that it may be cancelled
 * at a later time.
 */
exports.latch = function (actions, callback) {
	var cnt = actions.length;
	var cb = function() {
		if(--cnt != 0) {
			return;
		} else {
			callback.apply(this, arguments);
		}
	};
	return actions.map(function(f) {
		f(cb);
	});
};

/*
 * A unique ID counter starting from 0.
 * reset is anything that could be boolean true,
 * will return 0, and set the internal count to 1
 * just as iff getUniqueId() had been called the
 * first time.
 */
exports.getUniqueId = (function() {
	var id = 0;
	return function(reset) {
		if(reset) {
			id = 1;
			return 0;
		} else {
			return id++;
		}
	};
})();

/*
 * Same as getUniqueId, except it maintains a
 * map of counters via a string prefix.  Resets
 * only happen for the given prefix.
 */
exports.getUniquePrefixId = (function() {
	var ids = {};
	return function(prefix, reset) {
		ids[prefix] = ids[prefix] || 0;
		if(reset) {
			ids[prefix] = 1;
			return prefix + 0;
		} else {
			return prefix + ids[prefix]++;
		}
	};
})();

/*
 * This is destructive!
 * It returns the list as a convenience.
 */
exports.randomize = function(list) {
	for(var i = 0; i < list.length; i++) {
		var j = Math.floor(Math.random() * list.length);
		var tempi = list[i];
		list[i] = list[j];
		list[j] = tempi;
	}
	return list;
};

/*
 * This only makes a new list, the items in the list are shared between this and the old!
 */
exports.safeRandomize = function(list) {
	return exports.randomize(list.concat([]));
};

/*
 * Apply callback to each item in items, setting a timeout of delay milliseconds
 * after each execution.  A callback that takes a while to run will add to the time
 * before the next invocation.
 */
exports.delayMap = function(items, callback, delay, last) {
	var o = {};
	var i = 0;
	var f = function() {
		if(i < items.length) {
			callback(items[i++]);
			return o.id = setTimeout(f, delay);
		} else if(i >= items.length && last) {
			last();
		}
	};
	o.id = f();
	return o;
};

/*
exports.delayMap([1,2,3,4,5,6], console.log, 1000);
*/

/*
 * Limit the execution of a function to once during a set interval,
 * then queue up any invocations after the first.  A timeout object
 * is returned so queued up invocations can be cleared out.
 */
exports.throttle = function (func, t, ctx) {
	var timeout = false
	  , queue = []
	  , qf = function() {
		  var q = queue.shift();
		  if(q) { q(); timeout = setTimeout(qf, t); } else { timeout = false; }
	  }
	  ;
	
	var f = function() {
		var args = arguments
		  , self = this
		  , i = function() {
			func.apply(self, args);
		};
		if(timeout && timeout._idleNext) {
			queue.push(i);
		} else {
			i();
			timeout = setTimeout(qf, t);
		}
		return timeout;
	};

	return f;
}

/*
var l = exports.throttle(function(a, b) { console.log([a, b]); }, 1000);

l('a', 1);
l('b', 2);
l('c', 3);
setTimeout(function(){l('d', 4);}, 2000);
*/

/*
 * Limit the execution of a function to once during a set interval,
 * then queue up any invocations after the first.  A timeout object
 * is returned so queued up invocations can be cleared out.
 */
exports.burstThrottle = function (func, b, bt, t, ctx) {
	var timeout = false
	  , bTimeout = false
	  , burst = 0
	  , queue = []
	  , qf = function() {
		  var q = queue.shift();
		  if(q) { q(); timeout = setTimeout(qf, t); } else { timeout = false; }
	  }
	  ;
	
	var f = function() {
		var args = arguments
		  , self = this
		  , i = function() {
			func.apply(self, args);
		};
		if(timeout && timeout._idleNext) {
			queue.push(i);
		} else {
			if(burst++ >= b) {
				timeout = setTimeout(qf, t);
				queue.push(i);
			} else {
				i();
			}
			if(!bTimeout) {
				bTimeout = setTimeout(function() {
					burst = 0;
				}, bt);
			}
		}
		return timeout;
	};

	return f;
}

/**
 * This will call fn up until you hit a number of invocations equal
 * to count, as long as it's within the span specified by time.  Entries
 * will roll off, as the time of the history is checked with each invocaiton.
 */
exports.capacityThrottle = function (fn, count, time) {
	var timeout = false
	  , queue = []
	  , history = []
	  , qf = function() {
		  history = [];
		  while(history.length < count && queue.length > 0) {
		  	var q = queue.shift()
			  , now = Date.now()
			  ;
			history.push(now);
			q();
		  }
		  if(queue.length > 0) {
			  timeout = setTimeout(qf, time);
		  }
	  }
	  ;

	var f = function() {
		var args = arguments
		  , self = this
		  , now = Date.now()
		  , i = function() {
			  fn.apply(self, args);
		  }
		  ;
		if(timeout && timeout._idleNext) {
			queue.push(i);
		} else {
			history.push(now);
			for(var idx = 0; idx < history.length; idx++) {
				if(now - history[idx] >= time) {
					history.shift();
				} else {
					break;
				}
			}
			if(history.length > count) {
				var elapsed = now - history[history.length - 2];
				timeout = setTimeout(qf, time - elapsed);
				queue.push(i);
			} else {
				i();
			}
		}
		return timeout;
	};

	return f;
}

/*
var f = exports.capacityThrottle(function(num) {
	console.log(num);
}, 5, 1000);

for(var i = 0; i < 20; i++) {
	f(i);
}
*/

/*
function O1() {
	this.c = exports.getUniqueId();
}

O1.prototype.p = function() {
	console.log(this.c);
};

function O2() {
	this.o = new O1();
	this.p = exports.burstThrottle(O2.prototype.pnt, 3, 1000, 2000);
}

O2.prototype.pnt = function() {
	this.o.p();
};

var o = new O2();

o.p();
o.p();
o.p();
o.p();
o.p();
o.p();
o.p();
o.p();
o.p();
o.p();

var l = exports.burstThrottle(function(a, b) { console.log([a, b]); }, 3, 1000, 2000);

l('a', 1);
l('b', 2);
l('c', 3);
l('d', 4);
l('e', 5);
l('f', 6);
setTimeout(function(){l('g', 7);}, 2000);
*/

exports.split = function(str, separator, limit) {
	var isep = str.indexOf(separator)
	  , ilast = 0
	  , sp = []
	  ;

	while(isep >= 0 && sp.length < limit - 1) {
		sp.push(str.substring(ilast, isep));
		ilast = isep + 1;
		isep = str.indexOf(separator, ilast);
	}
	sp.push(str.substring(ilast));

	return sp;
};

exports.group = function(a) {
	if(a.length < 2) {
		return [a];
	}
	var ret = [[a[0]]];
	for(var i = 1; i < a.length; i++) {
		if(ret[0][0] === a[i]) {
			ret[0].push(a[i]);
		} else {
			ret.unshift([a[i]]);
		}
	}
	return ret.reverse();
}
