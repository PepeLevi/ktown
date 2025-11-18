import sys

def print_path(path):
    print("this is the path",  path.replace('+', ' '))
    input()

if __name__ == "__main__":
    path = str(sys.argv[1])
    print_path(path)
