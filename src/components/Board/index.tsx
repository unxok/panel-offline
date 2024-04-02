import {
  BOARDS_LS_KEY,
  BOARDS_NEXT_ID_LS_KEY,
  PROSE_CUSTOM,
} from "@/lib/consts";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";
import { create } from "zustand";
import { Card, useCardStore } from "../Card";
import { Lane, LaneDraggable } from "../Lane";
import { buttonVariants } from "@/components/ui/button";
import {
  DialogHeader,
  DialogFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { ReactNode, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Markdown from "markdown-to-jsx";
import "github-markdown-css";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../ui/context-menu";

export type Board = {
  id: UniqueIdentifier;
  lanes?: Lane[];
  title?: string;
  description?: string;
  notes?: string;
  showNotes?: boolean;
};

export const Board = (props: Board & { cards?: Card[] }) => {
  const { title, lanes, description, cards, showNotes, notes } = props;
  const { addBoard, saveBoards } = useBoardStore();
  const [dialogEditOpen, setDialogEditOpen] = useState(false);
  const [dialogViewOpen, setDialogViewOpen] = useState(false);
  const updateShowNotes = (b: boolean) => {
    // console.log("got b: ", b);
    addBoard({
      ...props,
      showNotes: !b,
    });
    saveBoards();
  };

  return (
    <BoardContextMenuWrapper>
      <BoardContextMenuTrigger
        className={`flex h-fit w-full flex-col justify-start overflow-x-auto p-5 scrollbar scrollbar-track-transparent scrollbar-thumb-primary`}
      >
        <div className="flex gap-2">
          <div className="text-nowrap text-xl font-bold tracking-widest">
            {title ?? "Unnamed Board"}
          </div>
          <div className="text-muted-foreground">{cards?.length}</div>
        </div>
        <div className="text-muted-foreground">{description}</div>
        {!!showNotes && (
          <div className={PROSE_CUSTOM}>
            <Markdown>{notes ?? ""}</Markdown>
          </div>
        )}
      </BoardContextMenuTrigger>
      <div className="relative flex w-full flex-row items-start justify-start gap-3 p-5">
        {lanes?.map((props) => (
          <LaneDraggable
            key={props.id}
            {...props}
            cards={cards?.filter((item) => item.lane === props.id)}
          />
        )) ?? "no lanes yet"}
      </div>
      {/* </div> */}
      <BoardDialog
        defaultMode="edit"
        defaultData={props}
        open={dialogEditOpen}
        setOpen={(b) => setDialogEditOpen(b)}
      />
      <BoardDialog
        defaultMode="view"
        defaultData={props}
        open={dialogViewOpen}
        setOpen={(b) => setDialogViewOpen(b)}
      />
      <BoardContextMenuContent
        showNotes={!!!showNotes}
        setShowNotes={updateShowNotes}
        setViewOpen={setDialogViewOpen}
        setEditOpen={setDialogEditOpen}
        board={props}
      />
    </BoardContextMenuWrapper>
  );
};

type BoardStore = {
  boards?: Board[];
  nextAvailableId: number;
  setBoards: (callback: (boards?: Board[]) => Board[] | undefined) => void;
  addBoard: (board: Board) => void;
  saveBoards: (passedBoards?: Board[]) => void;
  deleteBoard: (boardId: Board["id"]) => void;
};

const loadBoards: () => Board[] | undefined = () => {
  const localBoards = localStorage.getItem(BOARDS_LS_KEY);
  try {
    return JSON.parse(localBoards ?? "");
  } catch (e) {
    toast.error(
      "An error occurred when loading local data. Check console for more information",
    );
    console.log(e);
    console.log("Boards found in local storage: ", localBoards);
  }
};

const loadNextBoardId = () => {
  const localNextId = localStorage.getItem(BOARDS_NEXT_ID_LS_KEY);
  const num = Number(localNextId);
  // TODO is this the best way to check???
  if (!(num > 0)) return 1;
  return num;
};

export const useBoardStore = create<BoardStore>()((set, get) => ({
  boards: loadBoards(),
  nextAvailableId: loadNextBoardId(),
  setBoards(callback) {
    set((state) => {
      const newBoards = callback(state.boards);
      return {
        ...state,
        boards: newBoards,
      };
    });
  },
  addBoard: (board) => {
    set((state) => {
      const copy = state.boards ? [...state.boards] : [];
      const foundIndex = copy.findIndex((b) => b.id === board.id);
      copy[foundIndex] = board;
      return {
        ...state,
        boards:
          foundIndex === -1
            ? [...copy, { ...board, id: state.nextAvailableId }]
            : [...copy],
        nextAvailableId:
          foundIndex === -1 ? state.nextAvailableId + 1 : state.nextAvailableId,
      };
    });
  },
  saveBoards: (passedBoards) => {
    // console.log("saving boards...");
    const { boards, nextAvailableId } = get();
    const newCards = passedBoards ? passedBoards : boards;
    localStorage.setItem(BOARDS_LS_KEY, JSON.stringify(newCards));
    localStorage.setItem(BOARDS_NEXT_ID_LS_KEY, nextAvailableId.toString());
  },
  deleteBoard: (boardId) => {
    set((state) => ({
      ...state,
      boards: state?.boards?.filter((b) => b.id !== boardId),
    }));
  },
}));

export const BoardDialog = ({
  trigger,
  defaultData,
  open,
  setOpen,
  defaultMode,
}: {
  trigger?: ReactNode;
  defaultData?: Board;
  open?: boolean;
  setOpen?: (b: boolean) => void;
  defaultMode: "edit" | "view";
}) => {
  const { addBoard, saveBoards } = useBoardStore();
  const defaultFormState = {
    id: defaultData?.id ?? -1,
    title: defaultData?.title ?? "",
    description: defaultData?.description ?? "",
    notes: defaultData?.notes ?? "",
    showNotes: defaultData?.showNotes ?? false,
    ...defaultData,
  };
  const [formValues, setFormValues] = useState<Board>(defaultFormState);
  const [mode, setMode] = useState(defaultMode);

  // useEffect(() => console.log(formValues), [formValues]);

  const updateFormValue = <T,>(key: string, value: string | T) => {
    setFormValues(
      (prev) =>
        prev && {
          ...prev,
          [key]: value,
        },
    );
  };

  const createBoard = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (!formValues) {
      e.preventDefault();
      return toast.error("You gotta have something in there");
    }
    addBoard(formValues);
    saveBoards();
    setFormValues(defaultFormState);
  };

  return (
    <Dialog open={open ?? undefined} onOpenChange={setOpen ?? undefined}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        onPointerDownOutside={() => setFormValues(defaultFormState)}
        className="h-5/6"
      >
        <DialogHeader>
          <Tabs
            className="pb-3"
            value={mode}
            onValueChange={(s) => setMode(s as "edit" | "view")}
          >
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="view">Preview</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "edit" && (
            <>
              <DialogTitle>
                {defaultData ? (
                  <span>
                    Editing&nbsp;
                    <i>{defaultData.title}</i>
                  </span>
                ) : (
                  `Creating a new board`
                )}
              </DialogTitle>
              <DialogDescription>
                {defaultData
                  ? "Mistakes happen :)"
                  : "More options coming soon!"}
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        <ScrollArea className="h-[60vh] px-5 py-2">
          {mode === "edit" ? (
            <div className="flex h-[60vh] flex-col gap-5 px-2">
              <div className="flex flex-col justify-start gap-2">
                <Label htmlFor="title" className="font-semibold tracking-wide">
                  Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={formValues?.title}
                  placeholder={"Unnamed Board"}
                  onChange={(e) =>
                    updateFormValue(e.currentTarget.id, e.currentTarget.value)
                  }
                />
                <span className="text-sm text-muted-foreground">
                  The title of your board
                </span>
              </div>
              <div className="flex flex-col justify-start gap-2">
                <Label
                  htmlFor="description"
                  className="font-semibold tracking-wide"
                >
                  Description
                </Label>
                <Input
                  id="description"
                  name="description"
                  value={formValues?.description}
                  placeholder={"some random description"}
                  onChange={(e) =>
                    updateFormValue(e.currentTarget.id, e.currentTarget.value)
                  }
                />
                <span className="text-sm text-muted-foreground">
                  The description to show under the title
                </span>
              </div>
              <MarkdownInput
                formValue={formValues.notes}
                updateFormValue={updateFormValue}
              />
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col justify-start gap-2">
                  <Label
                    htmlFor="showNotes"
                    className="font-semibold tracking-wide"
                  >
                    Show Notes
                  </Label>

                  <span className="text-sm text-muted-foreground">
                    Toggle on to always show notes under the description
                  </span>
                </div>
                <Switch
                  id="showNotes"
                  name="showNotes"
                  checked={formValues?.showNotes}
                  onCheckedChange={(b) =>
                    updateFormValue<boolean>("showNotes", b)
                  }
                />
              </div>
            </div>
          ) : (
            <CardView {...formValues} />
          )}
        </ScrollArea>
        <DialogFooter>
          {defaultData && (
            <DialogClose className={buttonVariants({ variant: "ghost" })}>
              Delete
            </DialogClose>
          )}
          <DialogClose
            className={buttonVariants({ variant: "default" })}
            onClick={createBoard}
          >
            {defaultData ? "Update" : "Create"}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MarkdownInput = ({
  formValue,
  updateFormValue,
}: {
  formValue?: string;
  updateFormValue: <T>(key: string, value: string | T) => void;
}) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="flex flex-col justify-start gap-2">
      <Label htmlFor="notes" className="font-semibold tracking-wide">
        Notes
      </Label>
      <Tabs
        value={showPreview ? "preview" : "raw"}
        onValueChange={(s) => setShowPreview(s === "raw" ? false : true)}
        className="w-[400px]"
      >
        <TabsList>
          <TabsTrigger value="raw">Raw</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
      </Tabs>
      {showPreview ? (
        <div
          className={
            PROSE_CUSTOM +
            " whitespace-pre-wrap rounded-md border !bg-transparent p-5"
          }
        >
          <Markdown>{formValue ?? ""}</Markdown>
        </div>
      ) : (
        <Textarea
          id="notes"
          name="notes"
          value={formValue}
          placeholder={"some random notes"}
          onChange={(e) =>
            updateFormValue(e.currentTarget.id, e.currentTarget.value)
          }
          className="scrollbar scrollbar-track-transparent scrollbar-thumb-secondary scrollbar-corner-transparent"
        />
      )}
      <span className="text-sm text-muted-foreground">
        Markdown support is here!
      </span>
    </div>
  );
};

const CardView = ({ title, description, notes }: Card) => (
  <div className={PROSE_CUSTOM}>
    <h1>{title}</h1>
    <p>{description}</p>
    <div>
      <Markdown>{notes ?? ""}</Markdown>
    </div>
  </div>
);

export const BoardContextMenuWrapper = ContextMenu;
export const BoardContextMenuTrigger = ContextMenuTrigger;
export const BoardContextMenuContent = ({
  setViewOpen,
  setEditOpen,
  showNotes,
  setShowNotes,
  board,
}: {
  setViewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showNotes: boolean;
  setShowNotes: (b: boolean) => void;
  board: Board;
}) => {
  const { deleteBoard, saveBoards, addBoard } = useBoardStore();
  const { setCards, saveCards } = useCardStore();
  return (
    <ContextMenuContent>
      <ContextMenuItem
        onClick={() => {
          setViewOpen(true);
        }}
      >
        View
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          setEditOpen(true);
        }}
      >
        Edit
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          // TODO this is a sketch temporary solution
          // need to change lanes to using numbers to do this properly
          const newLaneTitle = window.prompt(
            "Please enter the name for the new lane",
          );
          if (!newLaneTitle) {
            return toast.error("You must enter a non-empty name!");
          }
          if (board?.lanes?.some((l) => l.id === newLaneTitle)) {
            return toast.error("Lane already exists!");
          }
          const newLane: Lane = {
            id: newLaneTitle,
            title: newLaneTitle,
            board: board.id,
          };
          addBoard({
            ...board,
            lanes: board.lanes ? [...board.lanes, newLane] : [newLane],
          });
          saveBoards();
        }}
      >
        Add lane
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Delete lane</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {board?.lanes?.map((l) => (
            <ContextMenuItem
              key={`${l.id}-context-menu-delete-item`}
              onClick={() => {
                const confirmation = window.confirm(
                  "Are you sure? This will permanently delete this lane AND all the cards within it!",
                );
                if (!confirmation) return;
                setCards((cards) => {
                  if (!cards) return [];
                  return cards.filter(
                    (c) => !(c.board === l.board && c.lane === l.id),
                  );
                });
                addBoard({
                  ...board,
                  lanes: board?.lanes?.filter((lane) => lane.id !== l.id),
                });
                saveCards();
                saveBoards();
              }}
            >
              {l.title}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem
        onClick={() => {
          // TODO make this do a dialog
          const confirmation = window.confirm(
            "Are you sure? You can't undo this!",
          );
          if (confirmation) {
            deleteBoard(board.id);
            saveBoards();
          }
        }}
      >
        Delete
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuCheckboxItem
        checked={showNotes}
        onCheckedChange={setShowNotes}
      >
        Hide notes
      </ContextMenuCheckboxItem>
    </ContextMenuContent>
  );
};