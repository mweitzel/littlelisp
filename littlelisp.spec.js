var t = require('./littlelisp').littleLisp;

var is = function(input, type) {
  return Object.prototype.toString.call(input) === '[object ' + type + ']';
};

// takes an AST and replaces type annotated nodes with raw values
var unannotate = function(input) {
  if (is(input, 'Array')) {
    if (input[0] === undefined) {
      return [];
    } else if (is(input[0], 'Array')) {
      return [unannotate(input[0])].concat(unannotate(input.slice(1)));
    } else {
      return unannotate(input[0]).concat(unannotate(input.slice(1)));
    }
  } else {
    return [input.value];
  }
};

describe('littleLisp', function() {
  describe('parse', function() {
    it('should lex a single atom', function() {
      expect(t.parse("a").value).toEqual("a");
    });

    it('should lex an atom in a list', function() {
      expect(unannotate(t.parse("()"))).toEqual([]);
    });

    it('should lex multi atom list', function() {
      expect(unannotate(t.parse("(hi you)"))).toEqual(["hi", "you"]);
    });

    it('should lex list containing list', function() {
      expect(unannotate(t.parse("((x))"))).toEqual([["x"]]);
    });

    it('should lex list containing list', function() {
      expect(unannotate(t.parse("(x (x))"))).toEqual(["x", ["x"]]);
    });

    it('should lex list containing list', function() {
      expect(unannotate(t.parse("(x y)"))).toEqual(["x", "y"]);
    });

    it('should lex list containing list', function() {
      expect(unannotate(t.parse("(x (y) z)"))).toEqual(["x", ["y"], "z"]);
    });

    it('should lex list containing list', function() {
      expect(unannotate(t.parse("(x (y) (a b c))"))).toEqual(["x", ["y"], ["a", "b", "c"]]);
    });

    describe('atoms', function() {
      it('should parse out numbers', function() {
        expect(unannotate(t.parse("(1 (a 2))"))).toEqual([1, ["a", 2]]);
      });
    });
  });

  describe('interpret', function() {
    describe('lists', function() {
      it('should return empty list', function() {
        expect(t.interpret(t.parse('()'))).toEqual(null);
      });

      it('should return list of strings', function() {
        expect(function () { t.interpret(t.parse('("hi" "mary" "rose")')) }).toThrow()
        expect(t.interpret(t.parse('(list "hi" "mary" "rose")'))).toEqual(['hi', "mary", "rose"]);
      });

      it('should return list of numbers', function() {
        expect(t.interpret(t.parse("(list 1 2 3)"))).toEqual([1, 2, 3]);
      });

      it('should return list of numbers in strings as strings', function() {
        expect(t.interpret(t.parse('(list "1" "2" "3")'))).toEqual(["1", "2", "3"]);
      });
    });

    describe('atoms', function() {
      it('should return string atom', function() {
        expect(t.interpret(t.parse('"a"'))).toEqual("a");
      });

      it('should return string with space atom', function() {
        expect(t.interpret(t.parse('"a b"'))).toEqual("a b");
      });

      it('should return string with opening paren', function() {
        expect(t.interpret(t.parse('"(a"'))).toEqual("(a");
      });

      it('should return string with closing paren', function() {
        expect(t.interpret(t.parse('")a"'))).toEqual(")a");
      });

      it('should return string with parens', function() {
        expect(t.interpret(t.parse('"(a)"'))).toEqual("(a)");
      });

      it('should return number atom', function() {
        expect(t.interpret(t.parse('123'))).toEqual(123);
      });
    });

    describe('invocation', function() {
      it('should run print on an int', function() {
        var undo = hotSwap(console, 'log', function() {})
        expect(t.interpret(t.parse("(print 1)"))).toEqual(1);
        undo()
      });

      it('should return first element of list', function() {
        expect(t.interpret(t.parse("(first (list 1 2 3))"))).toEqual(1);
      });

      it('should return rest of list', function() {
        expect(t.interpret(t.parse("(rest (list 1 2 3))"))).toEqual([2, 3]);
      });
    });

    describe('lambdas', function() {
      it('should return correct result when invoke lambda w no params', function() {
        expect(t.interpret(t.parse("((lambda () \"asdf\"))"))).toEqual("asdf");
      });

      it('should return correct result when invoke lambda w no params', function() {
        expect(t.interpret(t.parse("((lambda () (rest (list 1 2))))"))).toEqual([2]);
      });

      it('should return correct result for lambda that takes and returns arg', function() {
        expect(t.interpret(t.parse("((lambda (x) x) 1)"))).toEqual(1);
      });

      it('should return correct result for lambda that returns list of vars', function() {
        expect(t.interpret(t.parse("((lambda (x y) (list x y)) 1 2)"))).toEqual([1, 2]);
      });

      it('should get correct result for lambda that returns list of lits + vars', function() {
        expect(t.interpret(t.parse("((lambda (x y) (list 0 x y)) 1 2)"))).toEqual([0, 1, 2]);
      });

      it('returns rested lambda result', function() {
        expect(t.interpret(t.parse([
          '(                                  '
        , '  (lambda (a)                      '
        , '    (                              '
        , '      (lambda (b) (list a a b b))  '
        , '      "banana"                     '
        , '    )                              '
        , '  )                                '
        , '  "apple"                          '
        , ')                                  '
        ].join('\n')))).toEqual(['apple', 'apple', 'banana', 'banana'])
      })

      it('should return correct result when invoke lambda w params', function() {
        expect(t.interpret(t.parse("((lambda (l) (first l)) (list 1 2))")))
          .toEqual(1);
      });
    });

    describe('let', function() {
      it('should eval inner expression w names bound', function() {
        expect(t.interpret(t.parse("(let ((x 1) (y 2)) (list x y))"))).toEqual([1, 2]);
      });

      it('should not expose parallel bindings to each other', function() {
        // Expecting undefined for y to be consistent with normal
        // identifier resolution in littleLisp.
        expect(t.interpret(t.parse("(let ((x 1) (y x)) (list x y))"))).toEqual([1, undefined]);
      });

      it('should accept empty binding list', function() {
        expect(t.interpret(t.parse("(let () 42)"))).toEqual(42);
      });
    });

    describe('quote and eval', function() {
      it('quote does not evaluate, but holds form', function() {
        expect(t.interpret(t.parse("('(garbage))")))
          .toEqual({ type : 'form', value : [ { type : 'identifier', value : 'garbage' } ] })
        expect(t.interpret(t.parse("('(list 1 3))")))
          .toEqual({ type : 'form', value : [ { type : 'identifier', value : 'list' }, { type : 'number', value : 1 }, { type : 'number', value : 3 } ] })
      })
      var plus = function(a, b) { return a + b }
      var plus_ctx = { "+": plus }
      it('eval evaluates a quoted simple form', function() {
        expect(t.interpret(t.parse("(eval ('(+ 1 3)))"), plus_ctx))
          .toEqual(4)
      })
      it('eval evaluates a list of quoted forms', function() {
        expect(t.interpret(t.parse("(eval (list ('+) ('1) ('3)))"), plus_ctx)).toEqual(4)
        expect(t.interpret(t.parse("(eval (list (' +) 1 4))"), plus_ctx)).toEqual(5)
      })
      it('eval evaluates an unquoted simple object', function() {
        expect(t.interpret(t.parse("(eval(eval(eval 4)))"))).toEqual(4)
      })
      it('can quote and eval back and forth until the cows come home', function() {
        expect(t.interpret(t.parse("(eval (' (eval (' ( list 1 2)))))"))).toEqual([1,2])
      })
    });

    describe('if', function() {
      it('should choose the right branch', function() {
        expect(t.interpret(t.parse("(if 1 42 4711)"))).toEqual(42);
        expect(t.interpret(t.parse("(if 0 42 4711)"))).toEqual(4711);
      });
    });
  });
});

function hotSwap(obj, id, tmp) {
  var old = obj[id];
  obj[id] = tmp;
  return function() { obj[id] = old };
}
