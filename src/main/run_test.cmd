@echo off
cd /d "e:\TokenTrim\src\main"
node test_segment_parser.js > "e:\TokenTrim\src\main\test_output.txt" 2>&1
echo DONE >> "e:\TokenTrim\src\main\test_output.txt"
