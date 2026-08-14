import Link from "next/link";
import Header from "@/components/Header";
import { DollBlob } from "@/components/dolls";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="nf wrap">
        <span className="nf-doll float-b" aria-hidden="true">
          <DollBlob />
        </span>
        <p className="nf-big serif">404</p>
        <p className="nf-text">这一层架子是空的，东西大概被玩偶搬走了。</p>
        <Link className="btn" href="/">
          回陈列室 <span className="arr">→</span>
        </Link>
      </main>
    </>
  );
}
