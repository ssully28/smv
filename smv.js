/**
 * smv
 * Steve's MV to replace mv
 * 
 * Won't ruthlessly over-write existing files like mv does...
 * 
 * Right now I'm only allowing 2 arguments, a source
 * and a target. Eventually I'd like ot add the option to
 * do bulk moves.
 * Like:
 * smv [folder/*.txt] [folder] 
 * 
 * RUN:
 * node smv.js [source] [target]
 * 
 * Also can try running with a regex as the source:
 * node smv.js -r=.txt$ [targetdir]
 * 
 * HELP/EXAMPLES:
 * node smv.js -h 
 * 
 * TODO - test against symbolic links and any other non directory file types...
 */

const { stdin, stdout } = process;
const fs = require('fs');
const path = require("path");

// Throw commandline args into an array:
const [, , ...args] = process.argv;

/**
 * If user asks for help (-h, or --help) or doesn't enter
 * any commandline arguments then print help to console
 */
if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  displayHelp();
}

if (args.length !== 2) {
  console.error(`ERROR: incorrect number of arguments...`);
  displayHelp();
}

main();
async function main() {

  // Pluck source and target from args:
  let [source, target] = args;

  /**
   * Here let's check if source is a regex or pattern of some sorts...
   * if it is, then we'll want to create a list of files in the src
   * dir (or CWD) that match pattern, and then move those to the 
   * target folder (which MUST be a folder)...
   */
  if (source.startsWith('-r=')) {

    // first double check that the target is valid....
    if (!isDir(target)) {
      console.error('ERROR: for regex use, target must be an existing directory');
      await process.exit();
    }

    console.log('Running pattern match...');

    /**
     * TODO - Test additional regex's....try some complex pattern matches
     */
    let regex = source.substr(3);
    console.log(regex);

    /**
     * Grab current working directory
     * TODO - eventually allow regex in non CWD...
     */
    const cwd = process.cwd();

    // A list for any files that match our regex
    const matchingFileList = [];

    // Run through CWD and check each file:
    fs.readdirSync(cwd).forEach((file) => {
      // matches regex:
      if (file.match(regex)) {
        // Is not a directory:
        if (!isDir(file)) {
          // If it's matches and it's a file, push it:
          matchingFileList.push(file);
        }
      };
    });

    // Make sure we found some actual files we can move...
    if (matchingFileList.length === 0) {
      console.log("No files found in current working directory that match that regex.");
    } else {
      // We apparently one or more files - process the move for each file:
      for (let f of matchingFileList) {
        console.log('File: ', f);
        await processMove(f, target);
      }
    }

  } else {
    /**
     * This is much more like plain old mv. Here we're just
     * handling a single source file and either a new file
     * name or a directory(with optional new file name).
     */

    // Quick test: If source doesn't exist it's an error:
    if (!exists(source)) {
      console.error(`ERROR: ${source} does not exist.`);
      process.exit();
    }

    /**
     * Not allowing for renaming/moving folders at this time...
     * That can wreak all sorts of havoc if someone were
     * to move their root folder or something!
     */
    if (isDir(source)) {
      console.error(`ERROR: ${source} is a directory.`);
      process.exit();
    }

    processMove(source, target);
  }

}

/**
 * processMove() - either renames or moves
 * or renames AND moves the src file to
 * the tar name (or directory)
 * 
 * needs async for user confirmation if 
 * trying to over-write an existing file.
 */
async function processMove(src, tar) {
  // For sanity - resolve target path to absolute path:
  let resolvedTarget = path.resolve(tar);

  // First check if the resolved target exists:
  if (exists(resolvedTarget)) {
    /**
     * If it does, check if it's a directory
     * in that case we should be able to just move the
     * file to that directory.
     */
    if (isDir(resolvedTarget)) {
      // Grab the filename from the source path to add to the target
      let fname = path.basename(src);

      console.log(`Moving ${fname} to folder ${resolvedTarget}...`);

      // If we don't already have a trailing '/' add it:
      if (resolvedTarget.substr(-1) !== '/') resolvedTarget += '/';


      // Aaaannnnndddd add it!
      resolvedTarget += fname;

      /**
       * Now that we have a full path for new file, let's double
       * check that it doesn't exist!
       */
      if (exists(resolvedTarget)) {
        // If it does, warn and ask to confirm they want to over-write
        console.log(`WARNING: a ${fname} already exists in that directory...`);

        if (await confirm('Do you wish to overwrite the destination file? (y|n)')) {
          renameFile(src, resolvedTarget);
          console.log(`DONE!`);
        } else {
          console.log("Move aborted...");
        }
      } else {
        // It doesn't exist - so just move it!
        renameFile(src, resolvedTarget);
        console.log(`DONE!`);
      }

      // Need to go through more edge cases before finalizing this:
      // renameFile(src, resolvedTarget);
      // console.log(`DONE!`);

    } else {
      /**
       * In this case the target exists but it is NOT a directory
       * which means it's a file, so rather than bulldoze the existing
       * file, let's ask the user if they REALLY want to over-write
       */
      console.log('WARNING: a file with that name already exists...');

      if (await confirm('Do you wish to overwrite the destination file? (y|n)')) {
        renameFile(src, resolvedTarget);
        console.log(`DONE!`);
      } else {
        console.log("Move aborted...");
      }

    }
  } else {
    // Just renaming the file to whatever the target
    console.log(`Renaming source to ${resolvedTarget}...`);
    renameFile(src, resolvedTarget);
    console.log(`DONE!`);

  }
}

/**
 * renameFile()
 * moves and/or renames file
 */
function renameFile(from, to) {
  try {
    fs.renameSync(from, to);
  } catch (err) {
    console.error(`ERROR: Could not move ${from} to ${to}: ${err}`);
    process.exit();
  }
}

/**
 * isDir()
 * If the path name given exists
 * then check if it's a directory
 * returns bool
 */
function isDir(pathName) {
  if (exists(pathName)) {
    return fs.lstatSync(pathName).isDirectory();
  } else {
    return false;
  }
}

/**
 * exists()
 * returns bool
 */
function exists(pathName) {
  return fs.existsSync(pathName);
}

/**
 * confirm() asks user a y||n question
 * returns bool
 * if input is 'y' returns true
 * else false
 */
async function confirm(question) {
  try {
    const confirmation = await getAnswer(question);
    stdin.pause();
    if (confirmation === 'y') {
      return true;
    } else {
      return false;
    }

  } catch (err) {
    console.error(`ERROR: could not read user input: ${err}`);
    process.exit();
  }
}

/**
 * getAnswer() writes question
 * to screen, waits user to enter
 * an answer via stdin (aka command line)
 */
function getAnswer(question) {
  return new Promise((resolve, reject) => {
    stdin.resume();
    stdout.write(question);
    stdin.on('data', data => resolve(data.toString().trim()));
    stdin.on('error', err => reject(err));
  });
}

/**
 * displayHelp()
 * Just prints the usage to the 
 * console.
 */
function displayHelp() {
  const help = `USAGE: 
node smv.js source target          --> renames source to target
node smv.js source dir_name        --> moves source to directory (directory must exist)
node smv.js -r=[regex] dir_name    --> moves any files found matching regex pattern

EXAMPLES:
RENAME A FILE:
node smv.js foo.txt bar.txt        --> filename is changed to bar.txt

MOVE A FILE (KEEP THE SAME NAME):
node smv.js foo.txt subdir/        --> moves foo.txt to subdir (subdir must exist)
node smv.js foo.txt subdir         --> same, trailing / is optional.
node smv.js foo.txt subdir/bar.txt --> moves foo to subdir and renames to bar.txt
node smv.js foo.txt ..             --> moves foo.txt up one dir from current working dir.

USE REGEX: note: experimental
node smv.js -r=.txt$ subdir/       --> any files ending in '.txt' transfer to subdir
node smv.js -r=[a-b]+\.txt$ subdir --> a.txt, b.txt move to subdir; c.txt, a.xml do not
  `;

  console.log(help);
  process.exit();
}
