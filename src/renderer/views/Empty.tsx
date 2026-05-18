type Props = {
	title: string;
	subtitle?: string;
	muted?: boolean;
};

export function Empty({ title, subtitle, muted }: Props) {
	return (
		<div className={`empty${muted ? " empty--muted" : ""}`}>
			<h2 className="empty__title">{title}</h2>
			{subtitle ? <p className="empty__subtitle">{subtitle}</p> : null}
		</div>
	);
}
