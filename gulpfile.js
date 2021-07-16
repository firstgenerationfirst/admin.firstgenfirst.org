const gulp = require("gulp");
const child = require("child_process");
const gutil = require("gulp-util");
const cache = require("gulp-cached");
const babel = require("gulp-babel");
const uglify = require("gulp-uglify");

exports.jekyll = function jekyll() {
  const jekyll = child.spawn("bundle", ["exec", "jekyll", "serve", "--incremental"]);

  const jekyllLogger = (buffer) => {
    buffer.toString()
      .split(/[\n\r]+/)
      .forEach((message) => message.trim() && gutil.log(message));
  };

  jekyll.stdout.on("data", jekyllLogger);
  jekyll.stderr.on("data", jekyllLogger);
  return jekyll;
};

exports.minifyscripts = function minifyscripts() {
  return gulp.src("./scripts/**/*.js")
    .pipe(cache("minifyscripts"))
    .pipe(babel({
      presets: ["@babel/preset-env", "@babel/preset-react"],
      compact: false
    }))
    .pipe(uglify())
    .pipe(gulp.dest("./minscripts"));
}

exports.watch = function watch() {
  gulp.watch("./scripts/**/*.js", exports.minifyscripts);
}

exports.default = gulp.parallel(
  exports.jekyll,
  gulp.series(
    exports.minifyscripts,
    exports.watch
  )
);