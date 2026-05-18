import { type JSX, type ReactNode } from "react";

const BOLD_PATTERN = /\*\*(.+?)\*\*/g;
const INLINE_CODE_PATTERN = /`([^`]+)`/g;

type Block =
	| { kind: "heading"; level: 1 | 2 | 3; text: string }
	| { kind: "paragraph"; text: string }
	| { kind: "list"; items: string[] };

export function Markdown({ source }: { source: string }) {
	const blocks = parseBlocks(source);
	return (
		<div className="md">
			{blocks.map((block, index) => renderBlock(block, index))}
		</div>
	);
}

function renderBlock(block: Block, key: number): JSX.Element {
	switch (block.kind) {
		case "heading": {
			const text = renderInline(block.text);
			if (block.level === 1) return <h1 key={key}>{text}</h1>;
			if (block.level === 2) return <h2 key={key}>{text}</h2>;
			return <h3 key={key}>{text}</h3>;
		}
		case "paragraph":
			return <p key={key}>{renderInline(block.text)}</p>;
		case "list":
			return (
				<ul key={key}>
					{block.items.map((item, itemIndex) => (
						<li key={itemIndex}>{renderInline(item)}</li>
					))}
				</ul>
			);
	}
}

function parseBlocks(source: string): Block[] {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const blocks: Block[] = [];
	let paragraph: string[] = [];
	let list: string[] = [];

	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
		paragraph = [];
	};
	const flushList = () => {
		if (list.length === 0) return;
		blocks.push({ kind: "list", items: list });
		list = [];
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (line.trim() === "") {
			flushParagraph();
			flushList();
			continue;
		}
		const heading = /^(#{1,3})\s+(.*)$/.exec(line);
		if (heading) {
			flushParagraph();
			flushList();
			const level = heading[1].length as 1 | 2 | 3;
			blocks.push({ kind: "heading", level, text: heading[2].trim() });
			continue;
		}
		const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
		if (bullet) {
			flushParagraph();
			list.push(bullet[1].trim());
			continue;
		}
		flushList();
		paragraph.push(line.trim());
	}
	flushParagraph();
	flushList();
	return blocks;
}

function renderInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	const tokens = tokenizeInline(text);
	tokens.forEach((token, index) => {
		switch (token.kind) {
			case "text":
				nodes.push(token.value);
				break;
			case "bold":
				nodes.push(<strong key={index}>{token.value}</strong>);
				break;
			case "code":
				nodes.push(<code key={index}>{token.value}</code>);
				break;
		}
	});
	return nodes;
}

type InlineToken =
	| { kind: "text"; value: string }
	| { kind: "bold"; value: string }
	| { kind: "code"; value: string };

function tokenizeInline(text: string): InlineToken[] {
	const matches: Array<{
		start: number;
		end: number;
		token: InlineToken;
	}> = [];

	BOLD_PATTERN.lastIndex = 0;
	for (const match of text.matchAll(BOLD_PATTERN)) {
		const start = match.index ?? 0;
		matches.push({
			start,
			end: start + match[0].length,
			token: { kind: "bold", value: match[1] },
		});
	}
	INLINE_CODE_PATTERN.lastIndex = 0;
	for (const match of text.matchAll(INLINE_CODE_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (
			matches.some((existing) => existing.start < end && existing.end > start)
		) {
			continue;
		}
		matches.push({
			start,
			end,
			token: { kind: "code", value: match[1] },
		});
	}
	matches.sort((a, b) => a.start - b.start);

	const tokens: InlineToken[] = [];
	let cursor = 0;
	for (const { start, end, token } of matches) {
		if (start > cursor) {
			tokens.push({ kind: "text", value: text.slice(cursor, start) });
		}
		tokens.push(token);
		cursor = end;
	}
	if (cursor < text.length) {
		tokens.push({ kind: "text", value: text.slice(cursor) });
	}
	return tokens;
}
