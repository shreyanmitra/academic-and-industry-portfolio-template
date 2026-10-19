"""Generate publication Markdown from Academic Pages CSV or TSV metadata."""
import argparse
from generator import generate
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_file')
    parser.add_argument('output_dir', nargs='?')
    args = parser.parse_args()
    for path in generate('publications', args.input_file, args.output_dir):
        print(path.name)
