import lz from 'https://esm.sh/lz-string@1.5.0';

interface Page {
  title: string;
  content: string;
  timestamp: number;
}

const TTL = 12 * 36e5; // 12 hrs
const PAGE = (id: string) => ['pages', id];

export async function Cache(path: string) {
  const KV = await Deno.openKv(path);

  return {
    async get(hash: string) {
      let data: Page = { title: '', content: '', timestamp: -1 };
      let error = undefined;

      try {
        const entry = await KV.get<Page>(PAGE(hash));
        if (entry.value === null) throw Error('Does not exist.');

        data = {
          title: entry.value.title,
          content: lz.decompress(entry.value.content),
          timestamp: entry.value.timestamp
        };
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async set(hash: string, title: string, content: string) {
      try {
        const compressed = lz.compress(content);

        await KV.set(PAGE(hash), {
          title,
          content: compressed,
          timestamp: Date.now()
        }, {
          expireIn: TTL
        });
      } catch (e) {
        console.error('Cache set error', e);
      }
    }
  };
}
