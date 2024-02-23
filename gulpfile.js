'use strict';

const gulp = require('gulp');
const rimraf = require('gulp-rimraf');
const tslint = require('gulp-tslint');
const shell = require('gulp-shell');

/**
 * Remove build directory.
 */
gulp.task('clean', function () {
    return gulp.src('build', {read: false, allowEmpty: true})
        .pipe(rimraf());
});

/**
 * Lint all custom TypeScript files.
 */
gulp.task('tslint', () => {
    return gulp.src(['src/*.ts', '!src/models/node_modules/**'])
        .pipe(tslint({
            formatter: 'prose'
        }))
        .pipe(tslint.report());
});

gulp.task('compile', shell.task([
    'npm run tsc',
]));

/**
 * Watch for changes in TypeScript
 */
gulp.task('watch', shell.task([
    'npm run tsc-watch',
]));

/**
 * Build the project.
 */
gulp.task('build', gulp.series(['clean', 'tslint',  'compile'], (cb) => {
    console.log('Building the project ...');
    cb();
}));

gulp.task('default', gulp.series(['build']));
