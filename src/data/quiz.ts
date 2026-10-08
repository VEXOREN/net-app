export type Question = [string, string[], number, string];

export const QUESTIONS: Question[] = [
["Adres 172.20.5.9 należy do klasy:",["A","B","C","D"],1,"Pierwszy oktet 128–191 → klasa B. Przy okazji to adres prywatny (172.16–172.31)."],
["Do czego służy klasa D (224–239)?",["Zarezerwowana na przyszłość","Multicast","Loopback","Adresy prywatne"],1,"Multicast. Skrypt pisze „reserved for future use”, ale to dotyczy klasy E (240–255)."],
["Który zakres to prywatna klasa B wg RFC 1918?",["172.16.0.0 – 172.31.255.255","172.0.0.0 – 172.255.255.255","169.254.0.0 – 169.254.255.255","128.0.0.0 – 128.255.255.255"],0,"172.16.0.0/12."],
["Windows bez serwera DHCP dostaje adres 169.254.x.y. Co to jest?",["Adres klasy C","APIPA / link-local","Adres multicast","Błąd karty"],1,"APIPA, 169.254.0.0/16 (RFC 3927)."],
["Po co host wysyła gratuitous ARP?",["Żeby poznać MAC bramy","Żeby wykryć konflikt IP i ogłosić swoje mapowanie IP↔MAC","Żeby pobrać adres z DHCP","Żeby wyczyścić tablicę MAC przełącznika"],1,"Pyta o własny adres: jeśli ktoś odpowie, jest konflikt. Przy okazji odświeża cache ARP sąsiadów."],
["Jaki docelowy MAC ma ARP Request?",["MAC bramy","FF:FF:FF:FF:FF:FF","00:00:00:00:00:00","MAC odbiorcy"],1,"Request to broadcast L2. Reply wraca unicastem."],
["PC11 pinguje PC21 w innej sieci. O czyj MAC pyta ARP?",["PC21","Bramy domyślnej (R1 Fa0/0)","SW1","Nikogo, używa broadcastu"],1,"Cel jest poza siecią lokalną, więc ramka idzie do MAC bramy."],
["Pakiet przechodzi przez router (bez NAT). Co się zmienia?",["IP src/dst","MAC src/dst","Oba","Nic"],1,"Adresy IP są end-to-end, MAC przepisywane na każdym skoku. Zmienia się też TTL."],
["Domyślny aging time tablicy MAC na Catalyst:",["30 s","300 s","3600 s","Nieskończony"],1,"300 s."],
["Krótki aging time (np. 10 s) oznacza:",["Mniej floodingu","Szybszą reakcję na przeniesione hosty, ale więcej floodingu","Wyłączenie uczenia","Brak różnicy"],1,"Wpisy szybko wygasają, więc switch częściej zalewa ramki na wszystkie porty. Długi czas: mniej floodu, ale wolniejsze zauważenie przeniesionego hosta."],
["Co robi `mac-address-table static <MAC_PC_A> vlan 1 drop`?",["Przypina MAC do portu","Odrzuca ruch z tym adresem MAC","Usuwa MAC z tablicy","Ustawia port w tryb trunk"],1,"Filtrowanie unicast MAC: ramki z tym adresem są odrzucane, więc ping z PC A przestaje działać."],
["Prompt `Switch(config-if)#` to tryb:",["User EXEC","Privileged EXEC","Global configuration","Interface configuration"],3,"Wchodzisz z global config poleceniem `interface`."],
["Przełącznik pracuje głównie w warstwie:",["1","2","3","4"],1,"L2, adresy MAC. Router to L3. Hub i repeater to L1."],
["Hub vs switch, domeny kolizyjne:",["Oba: jedna domena","Hub: jedna domena; switch: osobna na każdy port","Hub: osobna na port; switch: jedna","Żaden nie ma domen kolizyjnych"],1,"Hub powtarza sygnał na wszystkie porty. Switch rozdziela domeny kolizyjne, ale domena rozgłoszeniowa zostaje jedna (bez VLAN)."],
["Skutek ustawienia half duplex po jednej stronie i full po drugiej:",["Brak łącza","Kolizje (także późne) i spadek wydajności","Szybsza transmisja","Auto-naprawa przez MDIX"],1,"Duplex mismatch: łącze działa, ale gubi ramki."],
["Slot time w Ethernecie 10/100 Mb/s wynosi:",["64 bity","512 bitów (64 bajty)","1518 bajtów","96 bitów"],1,"512 bit times, stąd minimalna ramka 64 B. 96 bitów to IPG/IFG."],
["Do czego służy Auto-MDIX?",["Automatyczny wybór prędkości","Automatyczne dopasowanie do kabla prostego lub krosowanego","Szyfrowanie łącza","Agregacja portów"],1,"Port sam zamienia pary TX/RX."],
["Ile hostów zmieści /27?",["32","30","62","14"],1,"2^5 − 2 = 30. Dlatego 30 PC + router w LAN B z rysunku 2 wymaga /26."],
["„Adres prywatny jest routowalny”, jak pisze skrypt. To:",["Fałsz","Prawda w obrębie sieci prywatnej, ale nie w Internecie","Prawda wszędzie","Dotyczy tylko IPv6"],1,"Routery wewnętrzne przekazują go normalnie, ale ISP go filtrują, stąd NAT."],
["`show mac-address-table dynamic` pokazuje:",["Wszystkie wpisy","Tylko wpisy nauczone automatycznie","Tylko statyczne","Licznik wpisów"],1,"Wpisy dynamiczne, nauczone z adresów źródłowych ramek."]
];
